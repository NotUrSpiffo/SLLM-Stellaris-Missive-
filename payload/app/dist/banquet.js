"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.banquetView = banquetView;
exports.banquetDemo = banquetDemo;
exports.banquetMode = banquetMode;
const i18n_pick_1 = require("./i18n-pick");
function banquetView(row, host, guestClass, date, mode = 'normal') {
    if (row.phase !== 'prepared' || !row.greeting || !['grand', 'normal', 'humiliating'].includes(row.greeting))
        throw new Error((0, i18n_pick_1.L)('게임에서 접대 선택이 확인된 방문만 열 수 있습니다.', 'Only visits whose reception choice was confirmed in the game can be opened.'));
    return { host: { ...host, role: 'host' }, guest: { name: row.name, ruler: row.ruler || '방문 대표', cls: guestClass, role: 'guest' }, greeting: row.greeting, date, invitation: row.body, demo: false, visitId: row.id, mode };
}
function banquetDemo() {
    return { host: { name: '플레이어 제국', ruler: '대통령 아린 서', cls: 'human', role: 'host' }, guest: { name: '카르단 연맹', ruler: '집정관 토르 카엘', cls: 'arthropoid', role: 'guest' }, greeting: 'grand', date: '2201.06.01', invitation: '양국의 우호를 기념하며 귀국의 지도자를 우리 수도의 만찬에 초대합니다.', demo: true, visitId: null };
}
/** 기계 지성이 한쪽이라도 끼면 machine, 군집 의식이 끼면 hive(둘이 섞이면 주최(플레이어) 쪽을 따른다). */
function banquetMode(player, guest) { const g = player || guest || 0; return g === 1 ? 'machine' : g === 2 ? 'hive' : 'normal'; }
//# sourceMappingURL=banquet.js.map