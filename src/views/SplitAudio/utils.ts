import type { TimeInfo } from './types';

export function getTimeInfo(time: number): TimeInfo {
  const hour = Math.floor(time / 3600);
  const minute = Math.floor((time % 3600) / 60);
  const second = Math.floor(time % 60);
  const millisecond = Math.floor((time % 1) * 1000);
  return {
    hour,
    minute,
    second,
    millisecond
  };
}
// 将时间格式化为时：分：秒
export function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60);
  const secondsRemainder = Math.round(seconds) % 60;
  const paddedSeconds = `0${secondsRemainder}`.slice(-2);
  return (hours > 0 ? hours : '') + `${minutes}:${paddedSeconds}`;
}

export function timeInfoToStamp(timeInfo: TimeInfo): number {
  return (
    +timeInfo.hour * 3600 +
    +timeInfo.minute * 60 +
    +timeInfo.second +
    +timeInfo.millisecond / 1000
  );
}
