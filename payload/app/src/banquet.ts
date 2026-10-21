import type {DinnerInvite} from './dinner';
import { L } from './i18n-pick';
export interface BanquetSeat { name:string;ruler:string;cls:string;role:'host'|'guest' }
/** mode: 일반 제국 간 만찬(normal), 기계 지성이 낀 '데이터 동기화'(machine), 군집 의식이 낀 '의식 공유'(hive). 없으면 normal */
export type BanquetMode='normal'|'machine'|'hive';
export interface BanquetView { mode?:BanquetMode;host:BanquetSeat;guest:BanquetSeat;greeting:'grand'|'normal'|'humiliating';date:string;invitation:string;demo:boolean;visitId:number|null }
export function banquetView(row:DinnerInvite,host:BanquetSeat,guestClass:string,date:string,mode:BanquetMode='normal'):BanquetView {
 if(row.phase!=='prepared'||!row.greeting||!['grand','normal','humiliating'].includes(row.greeting))throw new Error(L('게임에서 접대 선택이 확인된 방문만 열 수 있습니다.', 'Only visits whose reception choice was confirmed in the game can be opened.'));
 return {host:{...host,role:'host'},guest:{name:row.name,ruler:row.ruler||'방문 대표',cls:guestClass,role:'guest'},greeting:row.greeting,date,invitation:row.body,demo:false,visitId:row.id,mode};
}
export function banquetDemo():BanquetView {
 return {host:{name:'플레이어 제국',ruler:'대통령 아린 서',cls:'human',role:'host'},guest:{name:'카르단 연맹',ruler:'집정관 토르 카엘',cls:'arthropoid',role:'guest'},greeting:'grand',date:'2201.06.01',invitation:'양국의 우호를 기념하며 귀국의 지도자를 우리 수도의 만찬에 초대합니다.',demo:true,visitId:null};
}

/** 기계 지성이 한쪽이라도 끼면 machine, 군집 의식이 끼면 hive(둘이 섞이면 주최(플레이어) 쪽을 따른다). */
export function banquetMode(player:number|undefined,guest:number|undefined):BanquetMode{const g=player||guest||0;return g===1?'machine':g===2?'hive':'normal';}
