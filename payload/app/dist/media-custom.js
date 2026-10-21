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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.brandData = brandData;
exports.storeBrand = storeBrand;
exports.resetBrand = resetBrand;
exports.mediaView = mediaView;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
__exportStar(require("./media-prefs"), exports);
const galnews_1 = require("./galnews");
const media_prefs_1 = require("./media-prefs");
const i18n_pick_1 = require("./i18n-pick");
function brandFile(id, kind) {
    if (!media_prefs_1.MEDIA_FAMILIES.some((f) => f.id === id) || !['paper', 'radio'].includes(kind))
        throw new Error((0, i18n_pick_1.L)('알 수 없는 브랜드입니다.', 'Unknown brand.'));
    return path.join(electron_1.app.getPath('userData'), 'media-brands', id + '-' + kind + '.png');
}
function brandData(id, kind) {
    try {
        return 'data:image/png;base64,' + fs.readFileSync(brandFile(id, kind)).toString('base64');
    }
    catch {
        return null;
    }
}
function storeBrand(id, kind, source) {
    const dest = brandFile(id, kind);
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(source).toLowerCase()))
        throw new Error((0, i18n_pick_1.L)('PNG, JPG, WEBP 그림을 선택하세요.', 'Choose a PNG, JPG or WEBP image.'));
    if (fs.statSync(source).size > 8 * 1024 * 1024)
        throw new Error((0, i18n_pick_1.L)('8MB 이하의 그림을 선택하세요.', 'Choose an image of 8 MB or less.'));
    let img = electron_1.nativeImage.createFromBuffer(fs.readFileSync(source));
    if (img.isEmpty())
        throw new Error((0, i18n_pick_1.L)('이 그림을 읽을 수 없습니다. PNG 또는 JPG로 다시 저장해 주세요.', 'This image cannot be read. Please save it again as PNG or JPG.'));
    const size = img.getSize();
    if (Math.max(size.width, size.height) > 512)
        img = img.resize(size.width >= size.height ? { width: 512 } : { height: 512 });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, img.toPNG());
}
function resetBrand(id, kind) {
    const file = brandFile(id, kind);
    if (fs.existsSync(file))
        fs.unlinkSync(file);
}
function mediaView(prefs) {
    return media_prefs_1.MEDIA_FAMILIES.map((f, i) => ({ ...f, name: prefs[i]?.paperName || galnews_1.PAPERS[i].name, radio: prefs[i]?.radioName || f.radio, defaultName: galnews_1.PAPERS[i].name, defaultRadio: f.radio, persona: prefs[i]?.persona || (0, media_prefs_1.defaultPersona)(i, i18n_pick_1.L),
        comments: prefs[i]?.comments ?? galnews_1.PAPERS[i].comments, customized: !!prefs[i]?.persona, font: prefs[i]?.font || 'auto',
        paperImage: brandData(f.id, 'paper'), radioImage: brandData(f.id, 'radio') }));
}
//# sourceMappingURL=media-custom.js.map