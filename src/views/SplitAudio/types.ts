export interface TimeInfo {
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}
export interface SplitAreaInfo {
  regionId: string;
  startTimeInfo: TimeInfo;
  endTimeInfo: TimeInfo;
}
