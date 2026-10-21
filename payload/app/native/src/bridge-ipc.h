#ifndef SLLM_BRIDGE_IPC_H
#define SLLM_BRIDGE_IPC_H
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#define BRIDGE_MAGIC 0x534C4C4Du
#define BRIDGE_MESSAGE L"SLLM.CommandBridge.v1"
#define BRIDGE_COOKIE 0x534C4C4D
enum { READY=1, RUNNING=2, COMPLETE=3, CANCELLED=4 };
enum { RESULT_OK=0, WRONG_TARGET=1, UNSUPPORTED_BUILD=2, INVALID_FILE=3, COMMAND_FAILED=4 };
typedef struct {
    DWORD magic, version, pid, tid;
    uint64_t token;
    volatile LONG state;
    DWORD result;
    char filename[16];
    DWORD gameStatus;
    DWORD reserved;
} BridgeRequest;
static void bridge_name(WCHAR *out, DWORD pid, uint64_t token, const WCHAR *suffix) {
    wsprintfW(out,L"Local\\SLLM-Bridge-%08lx-%08lx%08lx-%s",pid,
              (DWORD)(token>>32),(DWORD)token,suffix);
}
static int valid_filename(const char *name) {
    unsigned n=0;
    for(;n<16 && name[n];n++) {
        char c=name[n];
        if(!((c>='a'&&c<='z')||(c>='A'&&c<='Z')||(c>='0'&&c<='9')||c=='_'||c=='-') && c!='.')return 0;
    }
    return n>4 && n<16 && name[n-4]=='.' && name[n-3]=='i' && name[n-2]=='n' && name[n-1]=='i';
}
#endif
