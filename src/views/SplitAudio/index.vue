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
      <SplitArea
        v-if="wavesurfer && buffer"
        :regions="regions"
        :wavesurfer="wavesurfer"
        :totalTime="totalTime"
        :currentTime="currentTime"
        :isPaused="isPaused"
        :buffer="buffer"
        :fileName="fileName"
      />
    </template>
  </div>
</template>
<script lang="ts" setup>
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { UploadFilled } from '@element-plus/icons-vue';
import { formatTime } from './utils';
import SplitArea from './components/SplitArea.vue';
// 添加区域
const regions = RegionsPlugin.create();

const buffer = ref<ArrayBuffer | null>(null);
const audioUrl = ref<string>('');
let wavesurfer: WaveSurfer | null = null;
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
      console.log('交互');
      // wavesurfer?.playPause();
      // isPaused.value = !isPaused.value;
      toggleAudio();
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
      // nextTick(() => {
      //   getPaused();
      // });
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

function toggleAudio() {
  if (wavesurfer) {
    wavesurfer.playPause();
    isPaused.value = !isPaused.value;
  }
}

// 重新上传
function reset() {
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value);
    audioUrl.value = '';
  }
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
