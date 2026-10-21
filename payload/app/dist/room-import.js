"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRoomImport = parseRoomImport;
const short = (v, n) => typeof v === 'string' && v.length <= n ? v : '';
function parseRoomImport(content, fileName, kind) {
    if (kind !== 'book' && kind !== 'journal')
        throw Error('INVALID_RECORD');
    if (content.length > 4 * 1024 * 1024)
        throw Error('IMPORT_SIZE');
    const unknown = { sid: 'external', rulerId: 'unknown', rulerName: '', date: '' };
    const validate = (q, legacy = false) => {
        const title = q?.title, text = legacy ? q?.body : q?.text;
        if (typeof title !== 'string' || !title.trim() || title.length > 160 || typeof text !== 'string' || !text.trim() || text.length > (kind === 'book' ? 50000 : 20000))
            throw Error('INVALID_RECORD');
        let author = { ...unknown };
        if (q.author && typeof q.author === 'object')
            author = { sid: short(q.author.sid, 200) || 'external', rulerId: short(q.author.rulerId, 200) || 'unknown', rulerName: short(q.author.rulerName, 200), date: short(q.author.date, 60) };
        else if (legacy)
            author.rulerName = short(q.author, 200);
        let category = q.category;
        if (category === 'creative')
            category = 'writing';
        if (q.aiSummary !== undefined && (typeof q.aiSummary !== 'string' || q.aiSummary.length > 1500))
            throw Error('INVALID_RECORD');
        return { title: title.trim(), text, category: ['lore', 'species', 'history', 'writing'].includes(category) ? category : 'writing', author, sourceId: short(q.id, 200) || undefined, deleted: q.deleted === true, aiSummary: q.aiSummary || '' };
    };
    if (/\.(txt|md)$/i.test(fileName))
        return [validate({ title: fileName.replace(/\.[^.]+$/, '').slice(0, 160), text: content, author: unknown })];
    if (!/\.json$/i.test(fileName))
        throw Error('IMPORT_FORMAT');
    let data;
    try {
        data = JSON.parse(content.replace(/^\uFEFF/, ''));
    }
    catch {
        throw Error('IMPORT_FORMAT');
    }
    let records, legacy = false;
    if (data?.format === 'sllm-room-records' && data.version === 1 && data.kind === kind && Array.isArray(data.records)) {
        records = data.records;
        if (records.some(x => x?.kind !== kind))
            throw Error('IMPORT_FORMAT');
    }
    else if (kind === 'book' && data?.format === 'sllm-library' && data.version === 1 && Array.isArray(data.books)) {
        records = data.books;
        legacy = true;
    }
    else
        throw Error('IMPORT_FORMAT');
    if (!records.length || records.length > 2000 || records.some(x => x?.builtin))
        throw Error('IMPORT_FORMAT');
    return records.map(q => validate(q, legacy));
}
//# sourceMappingURL=room-import.js.map