(function(){function isoWeek(value) { const d = new Date(value + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); const year = d.getUTCFullYear(); return { year, week: Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7) }; }
const key = (d) => d.toISOString().slice(0, 10);
function dutchHolidays(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), month = Math.floor((h + l - 7 * m + 114) / 31), day = (h + l - 7 * m + 114) % 31 + 1;
    const easter = new Date(Date.UTC(year, month - 1, day));
    const relative = (offset) => { const date = new Date(easter); date.setUTCDate(date.getUTCDate() + offset); return key(date); };
    const king = new Date(Date.UTC(year, 3, 27));
    if (king.getUTCDay() === 0)
        king.setUTCDate(26);
    return [{ date: year + "-01-01", name: "Nieuwjaarsdag" }, { date: relative(-2), name: "Goede Vrijdag" }, { date: relative(0), name: "Eerste paasdag" }, { date: relative(1), name: "Tweede paasdag" }, { date: key(king), name: "Koningsdag" }, { date: year + "-05-05", name: "Bevrijdingsdag" }, { date: relative(39), name: "Hemelvaartsdag" }, { date: relative(49), name: "Eerste pinksterdag" }, { date: relative(50), name: "Tweede pinksterdag" }, { date: year + "-12-25", name: "Eerste kerstdag" }, { date: year + "-12-26", name: "Tweede kerstdag" }].sort((a, b) => a.date.localeCompare(b.date));
}

window.HFCalendar={isoWeek,dutchHolidays};})();
