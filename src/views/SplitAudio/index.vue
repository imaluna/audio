<template>
  <div class="p-slit-audio">
    <el-upload
      v-if="!audioUrl"
      class="upload-demo"
      drag
      action=""
      :before-upload="handleChangeFile"
      accept=".mp3,.wav,.ogg,.m4a"
    >
      <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
      <div class="el-upload__text">
        将音频文件拖拽到此处
        <em>或者点击这里</em>
      </div>
      <template #tip>
        <div class="el-upload__tip">音频文件不要超过1G</div>
      </template>
    </el-upload>
    <template v-else>
      <el-button @click="reset">重新上传</el-button>
      <div class="audio-wrap plr-10 ptb-20">
        <div ref="waveRef"></div>
        <div class="m-option mt-10">
          <div class="m-time-option flex-full-c">
            <p class="flex-c">
              <span class="toggle-btn flex-c mr-8" @click="toggleAudio">
                <img :src="playIcon" alt="" />
              </span>
              <span class="current-time">{{ formatTime(currentTime) }}</span>
            </p>
            <p>
              <span class="total-time">{{ formatTime(totalTime) }}</span>
            </p>
          </div>
        </div>
        <div class="m-percentage mt-10">
          <div
            class="progress"
            :style="{ width: 100 * (currentTime / totalTime) + '%' }"
          >
            <!-- <div class="slider" @mousedown="handleMouseDown"></div> -->
          </div>
        </div>
      </div>
      <div class="m-split-area">
        <div>
          <el-button ref="addBtnRef" type="primary" @click="addSplitArea">
            添加分割
          </el-button>
          <el-button
            v-if="splitAreaList.length > 1"
            ref="addBtnRef"
            type="primary"
            @click="zipDownload"
          >
            批量下载
          </el-button>
        </div>

        <ul class="m-split-lit mt-20">
          <li
            class="flex-c mt-20"
            v-for="(item, key) in splitAreaList"
            :key="item.regionId"
          >
            <div class="m-start m-split-time flex-c mr-30">
              <span class="mr-10 label text">起始点：</span>
              <template v-if="totalTimeInfo.hour > 0">
                <input
                  v-model="item.startTimeInfo.hour"
                  class="mr-5"
                  @change="handelInputChange(true, 'hour', key)"
                />
                <span class="text mr-10">时</span>
              </template>
              <input
                v-model="item.startTimeInfo.minute"
                class="mr-5"
                @change="handelInputChange(true, 'minute', key)"
              />
              <span class="text mr-10">分</span>
              <input
                v-model="item.startTimeInfo.second"
                class="mr-5"
                @change="handelInputChange(true, 'second', key)"
              />
              <span class="text mr-10">秒</span>
              <input
                v-model="item.startTimeInfo.millisecond"
                class="mr-5"
                @change="handelInputChange(true, 'millisecond', key)"
              />
              <span class="text mr-10">毫秒</span>
            </div>
            <div class="m-end m-split-time flex-c mr-20">
              <span class="mr-10 label text">结束点：</span>
              <template v-if="totalTimeInfo.hour > 0">
                <input
                  v-model="item.endTimeInfo.hour"
                  class="mr-5"
                  @change="handelInputChange(false, 'hour', key)"
                />
                <span class="text mr-10">时</span>
              </template>
              <input
                v-model="item.endTimeInfo.minute"
                class="mr-5"
                @change="handelInputChange(false, 'minute', key)"
              />
              <span class="text mr-10">分</span>
              <input
                v-model="item.endTimeInfo.second"
                class="mr-5"
                @change="handelInputChange(false, 'second', key)"
              />
              <span class="text mr-10">秒</span>
              <input
                v-model="item.endTimeInfo.millisecond"
                class="mr-5"
                @change="handelInputChange(false, 'millisecond', key)"
              />
              <span class="text mr-10">毫秒</span>
            </div>
            <el-button
              :icon="Download"
              type="primary"
              link
              @click="downloadSplit(item, key)"
            >
              下载
            </el-button>
            <el-button type="danger" link @click="handleRemove(key)">
              删除
            </el-button>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
<script lang="ts" setup>
import { bufferToWave, toAudioBuffer } from '@/utils/audio';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import type { Region } from 'wavesurfer.js/dist/plugins/regions.d.ts';
import type { SplitAreaInfo, TimeInfo } from './types';
import { randomColor } from '@/utils/index';
import type { ElButton } from 'element-plus';
import { Download, UploadFilled } from '@element-plus/icons-vue';
import { saveAs } from 'file-saver';
import jszip from 'jszip';
import deepClone from 'lodash.clonedeep';

// 添加区域
const regions = RegionsPlugin.create();

const buffer = ref<ArrayBuffer | null>(null);
const audioUrl = ref<string>('');
// const audioUrl = ref<string>('http://localhost:5173/audio/test.mp3');
let wavesurfer: WaveSurfer | null = null;
let activeRegion: Region | null = null;
const regionMap = reactive<Record<string, Region>>({});
const regionLoop = ref(false);
const totalTime = ref(0);
const currentTime = ref(0);
const isPaused = ref(true);
const fileName = ref('');
const playIcon = computed(() => {
  return new URL(
    `../../assets/images/${isPaused.value ? 'play' : 'pause'}.png`,
    import.meta.url
  ).href;
});
const createFromClick = ref(false);
const totalTimeInfo = computed(() => {
  return getTimeInfo(totalTime.value);
});
// 切割区域
const splitAreaList = reactive<SplitAreaInfo[]>([]);
// 缓存的前一份切割区域
const prevSplitAreaList = ref<SplitAreaInfo[]>([]);
async function handleChangeFile(file: File) {
  // 释放上一次的资源
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value);
  }
  audioUrl.value = URL.createObjectURL(file);
  fileName.value = file.name.split('.')[0];
  // 重置区域
  nextTick(() => {
    if (wavesurfer) {
      wavesurfer.destroy();
    }
    isPaused.value = true;
    createWave();
  });
  const reader = new FileReader();
  reader.readAsArrayBuffer(file);
  reader.onload = async (res) => {
    buffer.value = res.target?.result as ArrayBuffer;
  };
  return Promise.reject();
}
const waveRef = ref<InstanceType<typeof HTMLDivElement> | null>(null);
function createWave() {
  if (waveRef.value) {
    wavesurfer = WaveSurfer.create({
      container: waveRef.value,
      waveColor: 'rgb(200, 200, 200)',
      progressColor: 'rgb(100, 100, 100)',
      url: audioUrl.value,
      // 播放速度
      audioRate: 1,
      minPxPerSec: 1,
      dragToSeek: true,
      plugins: [regions]
    });
    wavesurfer.on('decode', () => {
      regions.enableDragSelection({
        color: 'rgba(255, 0, 0, 0.1)'
      });
    });
    wavesurfer.on('interaction', () => {
      wavesurfer?.playPause();
    });
    regions.on('region-clicked', (region, e) => {
      e.stopPropagation(); // prevent triggering a click on the waveform
      activeRegion = region;
      // 未播放，开始播放
      if (getPaused()) {
        region.play();
        isPaused.value = false;
      } else {
        // 如果正在播放，且在区域内，暂停
        if (
          currentTime.value >= region.start &&
          currentTime.value <= region.end
        ) {
          wavesurfer?.pause();
          isPaused.value = true;
        } else {
          region.play();
          isPaused.value = false;
        }
      }
    });
    regions.on('region-created', (region) => {
      if (createFromClick.value) {
        createFromClick.value = false;
        return;
      }
      regionMap[region.id] = region;
      const { start, end } = region;
      const splitAreaInfo: SplitAreaInfo = {
        regionId: region.id,
        startTimeInfo: getTimeInfo(start),
        endTimeInfo: getTimeInfo(end)
      };
      splitAreaList.push(splitAreaInfo);
      cacheSplitAreaList();
    });

    regions.on('region-update', (region) => {
      let regionId = region.id;
      const splitArea = splitAreaList.find(
        (item) => item.regionId === regionId
      );
      // 更新时间
      if (splitArea) {
        splitArea.startTimeInfo = getTimeInfo(region.start);
        splitArea.endTimeInfo = getTimeInfo(region.end);
      }
      cacheSplitAreaList();
    });
    regions.on('region-out', (region) => {
      if (activeRegion === region) {
        if (regionLoop.value) {
          region.play();
        }
      }
    });
    wavesurfer.on('timeupdate', (time) => {
      currentTime.value = time;
    });
    wavesurfer.on('ready', () => {
      totalTime.value = wavesurfer?.getDuration() || 0;
    });
    wavesurfer.on('finish', () => {
      isPaused.value = true;
    });
    wavesurfer.on('click', () => {
      nextTick(() => {
        getPaused();
      });
    });
  }
}

// 是否暂停
function getPaused(): boolean {
  // @ts-ignore
  const res = !!wavesurfer?.media?.paused;
  isPaused.value = res;
  return res;
}

// 将时间格式化为时：分：秒
function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60);
  const secondsRemainder = Math.round(seconds) % 60;
  const paddedSeconds = `0${secondsRemainder}`.slice(-2);
  return (hours > 0 ? hours : '') + `${minutes}:${paddedSeconds}`;
}
function getTimeInfo(time: number): TimeInfo {
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
function toggleAudio() {
  if (wavesurfer) {
    wavesurfer.playPause();
    isPaused.value = !isPaused.value;
  }
}

function skip(second: number) {
  if (wavesurfer) {
    wavesurfer.skip(second);
  }
}
function downloadSplit(item: SplitAreaInfo, key: number) {
  const startTime = timeInfoToStamp(item.startTimeInfo);
  const endTime = timeInfoToStamp(item.endTimeInfo);
  handleExport(startTime, endTime, key);
}

async function getBlobByTime(startTime: number, endTime: number) {
  if (!buffer.value) return '';
  const { audioBuffer, frameCount } = await toAudioBuffer(
    buffer.value.slice(0),
    startTime,
    endTime
  );
  return bufferToWave(audioBuffer, frameCount);
}
async function handleExport(startTime: number, endTime: number, key: number) {
  const blob = await getBlobByTime(startTime, endTime);
  if (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.target = '_blank';
    // 下载的文件名，可自定义，也可以从response的headers中获取filename，后端需设置filename字段
    a.download = `${fileName.value + (key + 1)}.wav`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }
}
function timeInfoToStamp(timeInfo: TimeInfo): number {
  return (
    +timeInfo.hour * 3600 +
    +timeInfo.minute * 60 +
    +timeInfo.second +
    +timeInfo.millisecond / 1000
  );
}
const addBtnRef = ref<InstanceType<typeof ElButton> | null>(null);
function addSplitArea() {
  let startTime: number = 0;
  if (splitAreaList.length > 0) {
    const prev = splitAreaList[splitAreaList.length - 1];
    if (prev?.endTimeInfo) {
      startTime = timeInfoToStamp(prev.endTimeInfo);
    }
  }

  const endTime = Math.min(startTime + 5, totalTime.value);
  createFromClick.value = true;
  const region = regions.addRegion({
    start: startTime,
    end: endTime,
    content: '',
    color: randomColor(),
    drag: true,
    resize: true
  });
  splitAreaList.push({
    regionId: region.id,
    startTimeInfo: getTimeInfo(startTime),
    endTimeInfo: getTimeInfo(endTime)
  });
  cacheSplitAreaList();
  regionMap[region.id] = region;

  // 失焦，防止按空格键又触发添加分割
  if (addBtnRef.value) {
    addBtnRef.value.$el?.blur();
  }
}
// 删除
function handleRemove(key: number) {
  const item = splitAreaList[key];
  if (item.regionId) {
    const region = regionMap[item.regionId];
    delete regionMap[item.regionId];
    // 销毁region
    if (region) {
      region.remove();
    }
  }
  splitAreaList.splice(key, 1);
  cacheSplitAreaList();
}
// 批量下载
function zipDownload() {
  const zip = new jszip();
  splitAreaList.forEach(async (item, index) => {
    const blob = await getBlobByTime(
      timeInfoToStamp(item.startTimeInfo),
      timeInfoToStamp(item.endTimeInfo)
    );
    if (blob) {
      zip.file(`${fileName.value + (index + 1)}.wav`, blob, { binary: true });
    }
    if (index === splitAreaList.length - 1) {
      zip.generateAsync({ type: 'blob' }).then((newBlob) => {
        saveAs(newBlob, 'audio.zip');
      });
    }
  });
}
// 缓存前一份数据
function cacheSplitAreaList() {
  prevSplitAreaList.value = deepClone(splitAreaList);
}
function handelInputChange(
  isStart: boolean,
  type: keyof TimeInfo,
  index: number
) {
  const item = splitAreaList[index];
  if (item) {
    const timeKey = isStart ? 'startTimeInfo' : 'endTimeInfo';
    const timeInfo = item[timeKey];
    const prevValue = prevSplitAreaList.value[index]?.[timeKey]?.[type] || 0;

    const currentValue = timeInfo[type];
    const startTime = timeInfoToStamp(item.startTimeInfo);
    const endTime = timeInfoToStamp(item.endTimeInfo);

    const needChange =
      +currentValue < 0 ||
      !/^\d+$/.test(String(currentValue)) ||
      startTime >= endTime ||
      startTime < 0 ||
      endTime > totalTime.value;
    if (needChange) {
      timeInfo[type] = prevValue;
    } else {
      // 重新设置区域
      const region = regionMap[item.regionId];
      region.setOptions({ start: startTime, end: endTime });
      cacheSplitAreaList();
    }
    // 修改区域的start
  }
}
// 重新上传
function reset() {
  audioUrl.value = '';
  splitAreaList.length = 0;
  prevSplitAreaList.value = [];
  buffer.value = null;
}
</script>
<style lang="scss">
$m-color: #242121;
.p-slit-audio {
  max-width: 1200px;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 20px;
  margin: 0 auto;
}
.audio-wrap {
  .m-time-option {
    font-size: 16px;
  }
  .toggle-btn {
    cursor: pointer;
    img {
      width: 20px;
    }
  }
  .m-percentage {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background-color: #b7b3b3;
    position: relative;
    .progress {
      height: 100%;
      border-radius: 2px;
      background-color: $m-color;
      position: absolute;
      top: 0;
      left: 0;
      .slider {
        position: absolute;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 2px solid $m-color;
        background-color: #fff;
        top: -4px;
        right: -4px;
      }
    }
  }
}
.m-split-time {
  .text {
    font-size: 14px;
  }
  input {
    width: 40px;
    border: none;
    outline: none;
    border-bottom: 2px solid $m-color;
    background: transparent;
    text-align: center;
    font-size: 14px;
  }
}
</style>
