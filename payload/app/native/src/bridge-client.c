#include "bridge-ipc.h"
#include <tlhelp32.h>
#include <bcrypt.h>
#include <stdio.h>
#include <string.h>
static DWORD targetPid,targetTid;
static BOOL CALLBACK find_window(HWND window,LPARAM unused) {
    (void)unused;DWORD pid=0;DWORD tid=GetWindowThreadProcessId(window,&pid);
    if(pid==targetPid&&IsWindowVisible(window)&&!GetWindow(window,GW_OWNER)) {
        targetTid=tid;return FALSE;
    }
    return TRUE;
}
static int find_game(void) {
    HANDLE snapshot=CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS,0);
    if(snapshot==INVALID_HANDLE_VALUE)return 0;
    PROCESSENTRY32W process={0};process.dwSize=sizeof(process);
    unsigned count=0;
    if(Process32FirstW(snapshot,&process))do {
        if(_wcsicmp(process.szExeFile,L"stellaris.exe")==0){targetPid=process.th32ProcessID;count++;}
    }while(Process32NextW(snapshot,&process));
    CloseHandle(snapshot);
    if(count!=1)return 0;
    EnumWindows(find_window,0);return targetTid!=0;
}
int wmain(int argc,wchar_t**argv) {
    if(argc!=3){fputs("usage: bridge-client DLL-path request.ini\n",stderr);return 2;}
    char filename[16]={0};
    if(!WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,argv[2],-1,filename,sizeof(filename),NULL,NULL)||!valid_filename(filename)) {
        fputs("Invalid request filename\n",stderr);return 3;
    }
    if(!find_game()){fputs("Expected one running Stellaris window\n",stderr);return 4;}
    uint64_t token=0;
    if(BCryptGenRandom(NULL,(PUCHAR)&token,sizeof(token),BCRYPT_USE_SYSTEM_PREFERRED_RNG)<0)return 5;
    WCHAR name[128];bridge_name(name,targetPid,token,L"map");
    HANDLE mapping=CreateFileMappingW(INVALID_HANDLE_VALUE,NULL,PAGE_READWRITE,0,sizeof(BridgeRequest),name);
    if(!mapping||GetLastError()==ERROR_ALREADY_EXISTS){if(mapping)CloseHandle(mapping);return 6;}
    BridgeRequest*r=MapViewOfFile(mapping,FILE_MAP_ALL_ACCESS,0,0,sizeof(BridgeRequest));
    if(!r){CloseHandle(mapping);return 7;}
    memset(r,0,sizeof(*r));r->magic=BRIDGE_MAGIC;r->version=1;r->pid=targetPid;r->tid=targetTid;r->token=token;
    memcpy(r->filename,filename,sizeof(filename));r->state=READY;
    bridge_name(name,targetPid,token,L"done");HANDLE done=CreateEventW(NULL,TRUE,FALSE,name);
    HMODULE dll=LoadLibraryW(argv[1]);HHOOK hook=NULL;
    int exitCode=8;DWORD elapsed=0;ULONGLONG started=GetTickCount64();
    if(!done||!dll)goto cleanup;
    HOOKPROC callback=(HOOKPROC)GetProcAddress(dll,"BridgeMessage");
    if(!callback)goto cleanup;
    hook=SetWindowsHookExW(WH_GETMESSAGE,callback,dll,targetTid);
    if(!hook)goto cleanup;
    UINT message=RegisterWindowMessageW(BRIDGE_MESSAGE);
    if(!message||!PostThreadMessageW(targetTid,message,(WPARAM)token,BRIDGE_COOKIE))goto cleanup;
    DWORD wait=WaitForSingleObject(done,10000);
    elapsed=(DWORD)(GetTickCount64()-started);
    if(wait==WAIT_OBJECT_0&&InterlockedCompareExchange(&r->state,COMPLETE,COMPLETE)==COMPLETE)exitCode=r->result==RESULT_OK?0:9;
    else {InterlockedCompareExchange(&r->state,CANCELLED,READY);exitCode=10;}
cleanup:
    if(hook&&!UnhookWindowsHookEx(hook))exitCode=11;
    printf("{\"pid\":%lu,\"tid\":%lu,\"state\":%ld,\"result\":%lu,\"gameStatus\":%lu,\"elapsedMs\":%lu,\"exitCode\":%d}\n",targetPid,targetTid,r->state,r->result,r->gameStatus,elapsed,exitCode);
    if(dll)FreeLibrary(dll);
    if(done)CloseHandle(done);
    UnmapViewOfFile(r);CloseHandle(mapping);return exitCode;
}
