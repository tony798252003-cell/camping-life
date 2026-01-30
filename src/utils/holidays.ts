export interface Holiday {
    date: string; // YYYY-MM-DD
    name: string;
}

export const holidays: Holiday[] = [
    // 2025
    { date: '2025-01-01', name: '元旦' },
    { date: '2025-01-27', name: '小年夜' },
    { date: '2025-01-28', name: '除夕' },
    { date: '2025-01-29', name: '春節' },
    { date: '2025-01-30', name: '春節' },
    { date: '2025-01-31', name: '春節' },
    { date: '2025-02-01', name: '春節' },
    { date: '2025-02-02', name: '春節' },
    { date: '2025-02-28', name: '和平紀念日' },
    { date: '2025-04-03', name: '兒童節' },
    { date: '2025-04-04', name: '清明節' },
    { date: '2025-05-01', name: '勞動節' },
    { date: '2025-05-30', name: '端午節' },
    { date: '2025-05-31', name: '端午連假' },
    { date: '2025-06-01', name: '端午連假' },
    { date: '2025-10-04', name: '中秋節' },
    { date: '2025-10-05', name: '中秋連假' },
    { date: '2025-10-06', name: '中秋補假' },
    { date: '2025-10-10', name: '國慶日' },
    { date: '2025-10-11', name: '國慶連假' },
    { date: '2025-10-12', name: '國慶連假' },
    { date: '2025-10-25', name: '光復節' }, // New in 2025
    { date: '2025-12-25', name: '行憲紀念日' }, // New in 2025

    // 2026
    { date: '2026-01-01', name: '元旦' },
    { date: '2026-02-14', name: '連假' },
    { date: '2026-02-15', name: '小年夜' },
    { date: '2026-02-16', name: '除夕' },
    { date: '2026-02-17', name: '初一' },
    { date: '2026-02-18', name: '初二' },
    { date: '2026-02-19', name: '初三' },
    { date: '2026-02-20', name: '初四' },
    { date: '2026-02-21', name: '初五' },
    { date: '2026-02-22', name: '初六' },
    { date: '2026-02-27', name: '連假' },
    { date: '2026-02-28', name: '和平紀念日' },
    { date: '2026-03-01', name: '連假' },
    { date: '2026-04-03', name: '補假' },
    { date: '2026-04-04', name: '兒童節' },
    { date: '2026-04-05', name: '清明節' },
    { date: '2026-04-06', name: '補假' },
    { date: '2026-05-01', name: '勞動節' },
    { date: '2026-05-02', name: '連假' },
    { date: '2026-05-03', name: '連假' },
    { date: '2026-06-19', name: '端午節' },
    { date: '2026-06-20', name: '連假' },
    { date: '2026-06-21', name: '連假' },
    { date: '2026-09-25', name: '中秋節' },
    { date: '2026-09-26', name: '連假' },
    { date: '2026-09-27', name: '連假' },
    { date: '2026-10-09', name: '補假' },
    { date: '2026-10-10', name: '國慶日' },
    { date: '2026-10-11', name: '連假' },
    { date: '2026-10-24', name: '連假' },
    { date: '2026-10-25', name: '光復節' },
    { date: '2026-10-26', name: '連假' },
    { date: '2026-12-25', name: '行憲紀念日' },
    { date: '2026-12-26', name: '連假' },
    { date: '2026-12-27', name: '連假' },
]

export const isHoliday = (dateStr: string) => {
    return holidays.find(h => h.date === dateStr)
}
