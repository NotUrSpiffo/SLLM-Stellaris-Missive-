"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLANET_PIC = void 0;
exports.planetPicUrl = planetPicUrl;
exports.clearPlanetPicCache = clearPlanetPicCache;
// 게임 폴더의 행성 그림(gfx/event_pictures/*.dds)을 총독 배경으로 쓴다. 읽기 전용, 게임 파일은 복사하지 않고 실행 중에만 읽는다.
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const flagrender_1 = require("./flagrender");
/** 행성 종류 번호(sllm_pl_pc) -> 게임 그림 파일 이름. */
exports.PLANET_PIC = {
    1: 'desert_planet', 2: 'savannah', 3: 'continental_planet', 4: 'tropical_planet', 5: 'ocean_planet', 6: 'arctic_planet', 7: 'alpine',
    8: 'cold_barren_planet', 9: 'nuclear_explosion', 10: 'molten_planet', 11: 'toxic_planet', 12: 'gas_giant', 13: 'asteroid_field',
    14: 'city_planet', 15: 'ringworld', 16: 'habitat', 17: 'shrouded_planet', 18: 'hive', 19: 'arid_planet', 20: 'gaia_planet', 21: 'tundra_planet',
};
const cache = new Map();
function planetPicUrl(gameDir, pc) {
    const name = exports.PLANET_PIC[pc];
    if (!gameDir || !name)
        return null;
    const key = gameDir + '|' + pc;
    if (cache.has(key))
        return cache.get(key) ?? null;
    let url = null;
    try {
        const img = (0, flagrender_1.decodeDds)(fs.readFileSync(path.join(gameDir, 'gfx', 'event_pictures', name + '.dds')));
        if (img)
            url = 'data:image/png;base64,' + (0, flagrender_1.encodePng)((0, flagrender_1.shrink)(img, 450)).toString('base64');
    }
    catch { /* 없으면 그림으로 대신한다 */ }
    cache.set(key, url);
    return url;
}
function clearPlanetPicCache() { cache.clear(); }
//# sourceMappingURL=planetart.js.map