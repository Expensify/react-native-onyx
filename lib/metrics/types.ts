import type {PerformanceMeasure} from 'react-native-performance';

type Summary = {
    methodName: string;
    total: number;
    avg: number;
    max: number;
    min: number;
    lastCall?: PerformanceMeasure;
    calls: PerformanceMeasure[];
};

type Metrics = {
    summaries: Record<string, Summary>;
    totalTime: number;
    lastCompleteCall?: PerformanceMeasure;
};

type PrintMetricsOptions = {
    raw?: boolean;
    format?: 'console' | 'csv' | 'json' | 'string';
    methods?: string[];
};

type CallbackFunction<TArgs extends unknown[], TPromise> = (...args: TArgs) => Promise<TPromise>;

export type {Summary, Metrics, PrintMetricsOptions, CallbackFunction};
