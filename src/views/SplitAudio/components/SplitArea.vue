<template>
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
              @change="inputValidate(true, 'hour', key)"
            />
            <span class="text mr-10">时</span>
          </template>
          <input
            v-model="item.startTimeInfo.minute"
            class="mr-5"
            @change="inputValidate(true, 'minute', key)"
          />
          <span class="text mr-10">分</span>
          <input
            v-model="item.startTimeInfo.second"
            class="mr-5"
            @change="inputValidate(true, 'second', key)"
          />
          <span class="text mr-10">秒</span>
          <input
            v-model="item.startTimeInfo.millisecond"
            class="mr-5"
            @change="inputValidate(true, 'millisecond', key)"
          />
          <span class="text mr-10">毫秒</span>
        </div>
        <div class="m-end m-split-time flex-c mr-20">
          <span class="mr-10 label text">结束点：</span>
          <template v-if="totalTimeInfo.hour > 0">
            <input
              v-model="item.endTimeInfo.hour"
              class="mr-5"
              @change="inputValidate(false, 'hour', key)"
            />
            <span class="text mr-10">时</span>
          </template>
          <input
            v-model="item.endTimeInfo.minute"
            class="mr-5"
            @change="inputValidate(false, 'minute', key)"
          />
          <span class="text mr-10">分</span>
          <input
            v-model="item.endTimeInfo.second"
            class="mr-5"
            @change="inputValidate(false, 'second', key)"
          />
          <span class="text mr-10">秒</span>
          <input
            v-model="item.endTimeInfo.millisecond"
            class="mr-5"
            @change="inputValidate(false, 'millisecond', key)"
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
<script setup lang="ts">
import type { SplitAreaInfo, TimeInfo } from '../types';
import type { ElButton } from 'element-plus';
// @ts-ignore
import RegionsPlugin, { Region } from 'wavesurfer.js/dist/plugins/regions.d.ts';
import WaveSurfer from 'wavesurfer.js';

import { timeInfoToStamp, getTimeInfo } from '../utils';
import { randomColor } from '@/utils/index';
import { bufferToWave, toAudioBuffer } from '@/utils/audio';
import { Download } from '@element-plus/icons-vue';
import deepClone from 'lodash.clonedeep';
import { saveAs } from 'file-saver';
import jszip from 'jszip';
const props = defineProps({
  regions: {
    type: Object as PropType<RegionsPlugin>,
    required: true
  },
  totalTime: {
    type: Number,
    default: 0
  },
  buffer: {
    type: ArrayBuffer,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  isPaused: {
    type: Boolean,
    required: true
  },
  currentTime: {
    type: Number,
    required: true
  },
  wavesurfer: {
    type: Object as PropType<WaveSurfer>,
    required: true
  }
});
const createFromClick = ref(false);
const { isPaused, currentTime, wavesurfer } = toRefs(props);
const totalTimeInfo = computed(() => {
  return getTimeInfo(props.totalTime);
});
const regionMap = reactive<Record<string, Region>>({});
// 切割区域
const splitAreaList = reactive<SplitAreaInfo[]>([]);
// 缓存的前一份切割区域
const prevSplitAreaList = ref<SplitAreaInfo[]>([]);

const addBtnRef = ref<InstanceType<typeof ElButton> | null>(null);

// 添加切割区域
function addSplitArea() {
  let startTime: number = 0;
  if (splitAreaList.length > 0) {
    const prev = splitAreaList[splitAreaList.length - 1];
    if (prev?.endTimeInfo) {
      startTime = timeInfoToStamp(prev.endTimeInfo);
    }
  }

  const endTime = Math.min(startTime + 5, props.totalTime);
  createFromClick.value = true;
  const region = props.regions.addRegion({
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
// 输入时间校验
function inputValidate(
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
      endTime > props.totalTime;
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
// 下载切割区域
function downloadSplit(item: SplitAreaInfo, key: number) {
  const startTime = timeInfoToStamp(item.startTimeInfo);
  const endTime = timeInfoToStamp(item.endTimeInfo);
  handleExport(startTime, endTime, key);
}
// 通过开始和结束时间获取blob
async function getBlobByTime(startTime: number, endTime: number) {
  if (!props.buffer) return '';
  const { audioBuffer, frameCount } = await toAudioBuffer(
    props.buffer.slice(0),
    startTime,
    endTime
  );
  return bufferToWave(audioBuffer, frameCount);
}
// 下载/导出单个音频
async function handleExport(startTime: number, endTime: number, key: number) {
  const blob = await getBlobByTime(startTime, endTime);
  if (blob) {
    saveAs(blob, `${props.fileName + (key + 1)}.wav`)
  }
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
      zip.file(`${props.fileName + (index + 1)}.wav`, blob, { binary: true });
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
onMounted(() => {
  const { regions } = props;
  regions.on('region-clicked', (region, e) => {
    e.stopPropagation(); // prevent triggering a click on the waveform
    // 未播放，开始播放
    if (isPaused.value) {
      region.play();
      isPaused.value = false;
    } else {
      // 如果正在播放，且在区域内，暂停
      if (
        currentTime.value >= region.start &&
        currentTime.value <= region.end
      ) {
        wavesurfer.value?.pause();
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
    const splitArea = splitAreaList.find((item) => item.regionId === regionId);
    // 更新时间
    if (splitArea) {
      splitArea.startTimeInfo = getTimeInfo(region.start);
      splitArea.endTimeInfo = getTimeInfo(region.end);
    }
    cacheSplitAreaList();
  });
  regions.on('region-out', (region) => {});
});
</script>
