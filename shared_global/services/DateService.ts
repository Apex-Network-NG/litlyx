
import dayjs from 'dayjs';
import * as fns from 'date-fns';

export type Slice = keyof typeof slicesData;

const slicesData = {
    hour: {},
    day: {},
    week: {},
    month: {},
    year: {}
}

const startOfFunctions: { [key in Slice]: (date: Date) => Date } = {
    hour: fns.startOfHour,
    day: fns.startOfDay,
    week: fns.startOfWeek,
    month: fns.startOfMonth,
    year: fns.startOfYear
};

const endOfFunctions: { [key in Slice]: (date: Date) => Date } = {
    hour: fns.endOfHour,
    day: fns.endOfDay,
    week: fns.endOfWeek,
    month: fns.endOfMonth,
    year: fns.endOfYear
};

class DateService {

    public slicesData = slicesData;

    getChartLabelFromISO(iso: string, offset: number, slice: Slice) {
        const date = new Date(new Date(iso).getTime() + offset * 1000 * 60);
        if (slice === 'hour') return fns.format(date, 'HH:mm');
        if (slice === 'day') return fns.format(date, 'dd/MM');
        if (slice === 'week') return fns.format(date, 'dd/MM');
        if (slice === 'month') return fns.format(date, 'MMMM');
        if (slice === 'year') return fns.format(date, 'YYYY');
        return iso;
    }

    canUseSlice(from: string | number | Date, to: string | number | Date, slice: Slice) {

        const daysDiff = fns.differenceInDays(
            new Date(new Date(to).getTime() + 1000),
            new Date(from)
        );

        return this.canUseSliceFromDays(daysDiff, slice);
    }

    canUseSliceFromDays(days: number, slice: Slice): [false, string] | [true, number] {
        // HOUR - 3 DAYS - 72 SAMPLES
        if (slice === 'hour' && (days > 3)) return [false, 'Date gap too big for this slice'];
        // DAY - 2 MONTHS - 62 SAMPLES
        if (slice === 'day' && (days > 31 * 2)) return [false, 'Date gap too big for this slice'];
        // MONTH - 4 YEARS - 60 SAMPLES
        if (slice === 'month' && (days > 365 * 4)) return [false, 'Date gap too big for this slice'];

        // DAY - 2 DAYS - 2 SAMPLES
        if (slice === 'day' && (days < 2)) return [false, 'Date gap too small for this slice'];
        // MONTH - 2 MONTHS - 2 SAMPLES
        if (slice === 'month' && (days < 31 * 2)) return [false, 'Date gap too small for this slice'];

        return [true, days]
    }

    startOfSlice(date: Date, slice: Slice) {
        const fn = startOfFunctions[slice];
        if (!fn) throw Error(`startOfFunction of slice ${slice} not found`);
        return fn(date);
    }

    endOfSlice(date: Date, slice: Slice) {
        const fn = endOfFunctions[slice];
        if (!fn) throw Error(`endOfFunction of slice ${slice} not found`);
        return fn(date);
    }


    getGranularityData(slice: Slice, dateField: string) {

        const dateFromParts: Record<string, any> = {};
        let granularity;

        switch (slice) {
            case 'hour':
                dateFromParts.hour = { $hour: { date: dateField } }
                granularity = granularity || 'hour';
            case 'day':
                dateFromParts.day = { $dayOfMonth: { date: dateField } }
                granularity = granularity || 'day';
            case 'month':
                dateFromParts.month = { $month: { date: dateField } }
                granularity = granularity || 'month';
            case 'year':
                dateFromParts.year = { $year: { date: dateField } }
                granularity = granularity || 'year';
        }

        return { dateFromParts, granularity }
    }

    /**
    * @deprecated interal to generateDateSlices
    */
    prepareDateRange(from: string, to: string, slice: Slice) {

        let fromDate = dayjs(from).minute(0).second(0).millisecond(0);
        let toDate = dayjs(to).minute(0).second(0).millisecond(0);

        switch (slice) {
            case 'day':
                fromDate = fromDate.hour(0);
                toDate = toDate.hour(0);
                break;
            case 'hour':
                break;
        }

        return {
            from: fromDate.toDate(),
            to: toDate.toDate()
        }
    }

    /**
    * @deprecated interal to generateDateSlices
    */
    createBetweenDates(from: string, to: string, slice: Slice) {
        let start = dayjs(from);
        const end = dayjs(to);
        const filledDates: dayjs.Dayjs[] = [];
        while (start.isBefore(end) || start.isSame(end)) {
            filledDates.push(start);
            start = start.add(1, slice);
        }
        return { dates: filledDates, from, to };
    }

    /**
     * @deprecated use generateDateSlices
     */
    fillDates(dates: string[], slice: Slice) {
        const allDates: dayjs.Dayjs[] = [];
        const firstDate = dayjs(dates.at(0));
        const lastDate = dayjs(dates.at(-1));
        let currentDate = firstDate.clone();

        allDates.push(currentDate);

        while (currentDate.isBefore(lastDate, slice)) {
            currentDate = currentDate.add(1, slice);
            allDates.push(currentDate);
        }

        return allDates;
    }

    /**
     * @deprecated use mergeDates
     */
    mergeFilledDates<T extends Record<string, any>, K extends keyof T>(dates: dayjs.Dayjs[], items: T[], dateField: K, slice: Slice, fillData: Omit<T, K>) {
        const result = new Array<T>();
        for (const date of dates) {
            const item = items.find(e => dayjs(e[dateField]).isSame(date, slice));
            result.push(item ?? { ...fillData, [dateField]: date.format() } as T);
        }
        return result;
    }

    generateDateSlices(slice: Slice, fromDate: Date, toDate: Date) {
        const slices: Date[] = [];
        let currentDate = fromDate;
        const addFunctions: { [key in Slice]: any } = { hour: fns.addHours, day: fns.addDays, week: fns.addWeeks, month: fns.addMonths, year: fns.addYears };
        const addFunction = addFunctions[slice];
        if (!addFunction) { throw new Error(`Invalid slice: ${slice}`); }
        while (fns.isBefore(currentDate, toDate) || currentDate.getTime() === toDate.getTime()) {
            slices.push(currentDate);
            currentDate = addFunction(currentDate, 1);
        }
        return slices;
    }

    isSameDayUTC(a: Date, b: Date) {
        return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
    }

    mergeDates(timeline: { _id: string, count: number }[], allDates: Date[], slice: Slice) {

        const result: { _id: string, count: number }[] = [];

        const isSames: { [key in Slice]: any } = { hour: fns.isSameHour, day: this.isSameDayUTC, week: fns.isSameWeek, month: fns.isSameMonth, year: fns.isSameYear, }

        const isSame = isSames[slice];

        if (!isSame) {
            throw new Error(`Invalid slice: ${slice}`);
        }

        for (const date of allDates) {
            result.push({ _id: date.toISOString(), count: 0 });
            for (const element of timeline) {
                const elementDate = new Date(element._id);
                if (isSame(elementDate, date)) {
                    const existingEntry = result.find(item => isSame(date, new Date(item._id)));
                    if (!existingEntry) throw new Error('THIS CANNOT HAPPEN');
                    existingEntry.count += element.count;
                }
            }
        }

        return result;
    }


}

const dateServiceInstance = new DateService();
export default dateServiceInstance;
