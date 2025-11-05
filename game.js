// 게임 캔버스 설정
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// 게임 상태
let gameActive = false; // 시작 화면에서 시작
let gameStarted = false;
let score = 0;
let health = 100;
let keys = {};
let boosterActive = false;
let boosterGauge = 100; // 부스터 게이지 (0-100)
let maxBoosterGauge = 100;
let boosterDrainRate = 1.5; // 초당 소모율
let boosterRechargeRate = 100 / 30; // 30초에 100% 충전
let weaponLevel = 1; // 무기 레벨 (1-5+)
let difficulty = 'normal'; // 난이도: easy, normal, hard
let enemySpawnRate = 0.02; // 적 생성 확률
let satellites = []; // 위성 배열
let enemySpeedMultiplier = 1.0; // 적 속도 배율
let gameStartTime = 0; // 게임 시작 시간

// 보스 시스템
let currentBoss = null;
let bossActive = false;
let bossSpawnScores = [250, 550, 900, 1600, 2500, 3500];
let defeatedBosses = []; // 이미 처치한 보스 점수 저장
let normalEnemiesDisabled = false; // 보스전 중 일반 적 비활성화

// 코인 및 상점 시스템
let coins = parseInt(localStorage.getItem('spaceGameCoins')) || 0;
let lastCoinScore = 0; // 마지막으로 코인을 받은 점수
let currentShip = localStorage.getItem('spaceGameCurrentShip') || 'red';
let ownedShips = JSON.parse(localStorage.getItem('spaceGameOwnedShips')) || ['red'];

// 오디오 컨텍스트 및 사운드 시스템
let audioContext;
let masterGain;

// 오디오 초기화
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.3;
        masterGain.connect(audioContext.destination);
    }
}

// 배경 음악 (Web Audio API로 생성)
let bgMusicSource = null;
let bgMusicGain = null;

// 박진감 넘치는 배경음악 생성
function startBackgroundMusic() {
    if (!audioContext) return;
    if (bgMusicSource) return; // 이미 재생 중이면 무시
    
    const now = audioContext.currentTime;
    
    // 베이스 라인 (어두운 분위기)
    const bass = audioContext.createOscillator();
    bass.type = 'sawtooth';
    bass.frequency.value = 55; // A1
    
    const bassGain = audioContext.createGain();
    bassGain.gain.value = 0.15;
    
    bass.connect(bassGain);
    bassGain.connect(masterGain);
    
    // 리듬 펄스
    const rhythm = audioContext.createOscillator();
    rhythm.type = 'square';
    rhythm.frequency.value = 110; // A2
    
    const rhythmGain = audioContext.createGain();
    rhythmGain.gain.value = 0;
    
    // 펄스 패턴 생성
    let time = now;
    const beatInterval = 0.4; // 150 BPM
    for (let i = 0; i < 200; i++) {
        rhythmGain.gain.setValueAtTime(0.08, time);
        rhythmGain.gain.setValueAtTime(0, time + 0.05);
        time += beatInterval;
    }
    
    rhythm.connect(rhythmGain);
    rhythmGain.connect(masterGain);
    
    // 화음 패드 (암울한 분위기)
    const chord1 = audioContext.createOscillator();
    chord1.type = 'sine';
    chord1.frequency.value = 220; // A3
    
    const chord2 = audioContext.createOscillator();
    chord2.type = 'sine';
    chord2.frequency.value = 261.63; // C4
    
    const chord3 = audioContext.createOscillator();
    chord3.type = 'sine';
    chord3.frequency.value = 329.63; // E4
    
    const chordGain = audioContext.createGain();
    chordGain.gain.value = 0.05;
    
    chord1.connect(chordGain);
    chord2.connect(chordGain);
    chord3.connect(chordGain);
    chordGain.connect(masterGain);
    
    // 긴장감을 주는 고음 신시사이저
    const lead = audioContext.createOscillator();
    lead.type = 'triangle';
    lead.frequency.value = 440; // A4
    
    const leadGain = audioContext.createGain();
    leadGain.gain.value = 0;
    
    // 멜로디 패턴
    let melodyTime = now;
    const notes = [440, 493.88, 523.25, 587.33, 523.25, 493.88]; // A, B, C, D, C, B
    for (let i = 0; i < 100; i++) {
        const noteIndex = i % notes.length;
        lead.frequency.setValueAtTime(notes[noteIndex], melodyTime);
        leadGain.gain.setValueAtTime(0.06, melodyTime);
        leadGain.gain.setValueAtTime(0, melodyTime + 0.3);
        melodyTime += 0.8;
    }
    
    lead.connect(leadGain);
    leadGain.connect(masterGain);
    
    // 모든 오실레이터 시작
    bass.start(now);
    rhythm.start(now);
    chord1.start(now);
    chord2.start(now);
    chord3.start(now);
    lead.start(now);
    
    // 80초 후 정지 및 재시작
    const duration = 80;
    bass.stop(now + duration);
    rhythm.stop(now + duration);
    chord1.stop(now + duration);
    chord2.stop(now + duration);
    chord3.stop(now + duration);
    lead.stop(now + duration);
    
    bgMusicSource = { bass, rhythm, chord1, chord2, chord3, lead };
    
    // 음악 반복
    setTimeout(() => {
        bgMusicSource = null;
        if (gameActive) {
            startBackgroundMusic();
        }
    }, duration * 1000);
}

// 배경음악 정지
function stopBackgroundMusic() {
    if (bgMusicSource && audioContext) {
        const now = audioContext.currentTime;
        bgMusicSource.bass && bgMusicSource.bass.stop(now);
        bgMusicSource.rhythm && bgMusicSource.rhythm.stop(now);
        bgMusicSource.chord1 && bgMusicSource.chord1.stop(now);
        bgMusicSource.chord2 && bgMusicSource.chord2.stop(now);
        bgMusicSource.chord3 && bgMusicSource.chord3.stop(now);
        bgMusicSource.lead && bgMusicSource.lead.stop(now);
        bgMusicSource = null;
    }
}

// 총 발사 효과음 ('뿅' 소리)
function playShootSound() {
    if (!audioContext) return;
    
    const now = audioContext.currentTime;
    
    // 높은 음에서 낮은 음으로 빠르게 하강
    const osc = audioContext.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
    
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    osc.connect(gain);
    gain.connect(masterGain);
    
    osc.start(now);
    osc.stop(now + 0.1);
}

// 폭발 효과음
function playExplosionSound() {
    if (!audioContext) return;
    
    const now = audioContext.currentTime;
    
    // 폭발 소리 (두 개의 노이즈 버스트)
    const noise = audioContext.createBufferSource();
    const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.3, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = Math.random() * 2 - 1;
    }
    noise.buffer = noiseBuffer;
    
    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(1000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(50, now + 0.2);
    
    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    
    noise.start(now);
    noise.stop(now + 0.3);
    
    // 폭발 저음 펄스
    const bass = audioContext.createOscillator();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(100, now);
    bass.frequency.exponentialRampToValueAtTime(30, now + 0.2);
    
    const bassGain = audioContext.createGain();
    bassGain.gain.setValueAtTime(0.4, now);
    bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    bass.connect(bassGain);
    bassGain.connect(masterGain);
    
    bass.start(now);
    bass.stop(now + 0.2);
}

// 아이템 획득 효과음
function playItemSound() {
    if (!audioContext) return;
    
    const now = audioContext.currentTime;
    
    // 상승하는 톤 (긍정적인 느낌)
    const osc1 = audioContext.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(400, now);
    osc1.frequency.exponentialRampToValueAtTime(800, now + 0.15);
    
    const osc2 = audioContext.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(500, now + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(1000, now + 0.2);
    
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(masterGain);
    
    osc1.start(now);
    osc2.start(now + 0.05);
    osc1.stop(now + 0.15);
    osc2.stop(now + 0.2);
}

// 플레이어 우주선
const player = {
    x: canvas.width / 2,
    y: canvas.height - 80,
    width: 30,
    height: 40,
    speed: 3.75, // 5 * 0.75 = 3.75
    color: '#ff0000',
    rotation: 0 // 기울임 각도 (라디안)
};

// 배열들
let playerBullets = [];
let enemies = [];
let enemyBullets = [];
let stars = [];
let planets = [];
let powerUps = [];
let healthItems = [];
let explosions = []; // 폭발 효과
let lastPowerUpSpawn = 0;
let lastHealthItemSpawn = 0;

// 리더보드
let leaderboard = JSON.parse(localStorage.getItem('spaceGameLeaderboard')) || [];

// 별 생성
function createStars() {
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speed: Math.random() * 0.5 + 0.2
        });
    }
}

// 행성 생성
function createPlanets() {
    for (let i = 0; i < 3; i++) {
        planets.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 20 + 10,
            speed: Math.random() * 0.2 + 0.1,
            color: `hsl(${Math.random() * 360}, 50%, 30%)`
        });
    }
}

// 플레이어 그리기 (멋진 빨간 우주선)
// 우주선 그리기 (입체적 디자인)
function drawPlayer() {
    ctx.save();
    
    // 우주선 중심점으로 이동 및 회전
    const centerX = player.x + player.width / 2;
    const centerY = player.y + player.height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate(player.rotation);
    ctx.translate(-centerX, -centerY);
    
    // 부스터 불꽃 효과
    if (boosterActive) {
        // 외곽 불꽃 (주황)
        ctx.fillStyle = 'rgba(255, 100, 0, 0.6)';
        ctx.beginPath();
        ctx.moveTo(player.x - 10, player.y + player.height);
        ctx.lineTo(player.x - 6, player.y + player.height + 18 + Math.random() * 4);
        ctx.lineTo(player.x - 3, player.y + player.height);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(player.x + 10, player.y + player.height);
        ctx.lineTo(player.x + 6, player.y + player.height + 18 + Math.random() * 4);
        ctx.lineTo(player.x + 3, player.y + player.height);
        ctx.fill();
        
        // 중간 불꽃 (밝은 주황)
        ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
        ctx.beginPath();
        ctx.moveTo(player.x - 8, player.y + player.height);
        ctx.lineTo(player.x - 5, player.y + player.height + 14);
        ctx.lineTo(player.x - 2, player.y + player.height);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(player.x + 8, player.y + player.height);
        ctx.lineTo(player.x + 5, player.y + player.height + 14);
        ctx.lineTo(player.x + 2, player.y + player.height);
        ctx.fill();
        
        // 내부 불꽃 (노랑)
        ctx.fillStyle = 'rgba(255, 255, 100, 0.9)';
        ctx.beginPath();
        ctx.moveTo(player.x - 6, player.y + player.height);
        ctx.lineTo(player.x - 4, player.y + player.height + 10);
        ctx.lineTo(player.x - 3, player.y + player.height);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(player.x + 6, player.y + player.height);
        ctx.lineTo(player.x + 4, player.y + player.height + 10);
        ctx.lineTo(player.x + 3, player.y + player.height);
        ctx.fill();
        
        // 중앙 불꽃 (흰색)
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.beginPath();
        ctx.moveTo(player.x - 3, player.y + player.height);
        ctx.lineTo(player.x, player.y + player.height + 6);
        ctx.lineTo(player.x + 3, player.y + player.height);
        ctx.fill();
    }
    
    // 우주선 종류별 렌더링
    switch(currentShip) {
        case 'red':
            drawRedShip();
            break;
        case 'blue':
            drawBlueShip();
            break;
        case 'black':
            drawBlackShip();
            break;
    }
    
    ctx.restore();
}

// 빨간 우주선 (기본) - 입체적 디자인
function drawRedShip() {
    const px = player.x;
    const py = player.y;
    
    // 그림자
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
    
    // 후면 날개 (어두운 부분)
    ctx.fillStyle = '#660000';
    ctx.beginPath();
    ctx.moveTo(px - 18, py + 30);
    ctx.lineTo(px - 28, py + 38);
    ctx.lineTo(px - 18, py + 38);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(px + 18, py + 30);
    ctx.lineTo(px + 28, py + 38);
    ctx.lineTo(px + 18, py + 38);
    ctx.closePath();
    ctx.fill();
    
    // 메인 몸체 외곽 (어두운 빨강)
    ctx.fillStyle = '#990000';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - 16, py + 42);
    ctx.lineTo(px - 8, py + 42);
    ctx.lineTo(px - 8, py + 48);
    ctx.lineTo(px + 8, py + 48);
    ctx.lineTo(px + 8, py + 42);
    ctx.lineTo(px + 16, py + 42);
    ctx.closePath();
    ctx.fill();
    
    // 메인 몸체 중앙 (밝은 빨강)
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.moveTo(px, py + 3);
    ctx.lineTo(px - 12, py + 42);
    ctx.lineTo(px - 6, py + 42);
    ctx.lineTo(px - 6, py + 45);
    ctx.lineTo(px + 6, py + 45);
    ctx.lineTo(px + 6, py + 42);
    ctx.lineTo(px + 12, py + 42);
    ctx.closePath();
    ctx.fill();
    
    // 중앙 하이라이트
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.moveTo(px, py + 8);
    ctx.lineTo(px - 8, py + 42);
    ctx.lineTo(px + 8, py + 42);
    ctx.closePath();
    ctx.fill();
    
    // 측면 엔진 블록
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(px - 15, py + 32, 6, 8);
    ctx.fillRect(px + 9, py + 32, 6, 8);
    
    // 엔진 하이라이트
    ctx.fillStyle = '#ff6666';
    ctx.fillRect(px - 14, py + 33, 2, 6);
    ctx.fillRect(px + 10, py + 33, 2, 6);
    
    // 콕핏 (유리창)
    const gradient = ctx.createRadialGradient(px, py + 18, 0, px, py + 18, 6);
    gradient.addColorStop(0, '#00ffff');
    gradient.addColorStop(0.6, '#0088ff');
    gradient.addColorStop(1, '#003366');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(px, py + 18, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // 콕핏 하이라이트
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(px - 1, py + 16, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // 측면 무기
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px - 12, py + 25);
    ctx.lineTo(px - 12, py + 35);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(px + 12, py + 25);
    ctx.lineTo(px + 12, py + 35);
    ctx.stroke();
    
    // 엔진 노즐 (빛나는 부분)
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(px - 10, py + 43, 4, 5);
    ctx.fillRect(px + 6, py + 43, 4, 5);
    
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(px - 9, py + 44, 2, 3);
    ctx.fillRect(px + 7, py + 44, 2, 3);
    
    // 장식 라인
    ctx.strokeStyle = '#ff6666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - 4, py + 10);
    ctx.lineTo(px - 4, py + 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + 4, py + 10);
    ctx.lineTo(px + 4, py + 30);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
}

// 파란 우주선 - 고급형
function drawBlueShip() {
    const px = player.x;
    const py = player.y;
    
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(0, 150, 255, 0.7)';
    
    // 후면 날개
    ctx.fillStyle = '#003366';
    ctx.beginPath();
    ctx.moveTo(px - 20, py + 28);
    ctx.lineTo(px - 30, py + 40);
    ctx.lineTo(px - 18, py + 40);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(px + 20, py + 28);
    ctx.lineTo(px + 30, py + 40);
    ctx.lineTo(px + 18, py + 40);
    ctx.closePath();
    ctx.fill();
    
    // 유선형 몸체 (어두운 파랑)
    ctx.fillStyle = '#0055aa';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.bezierCurveTo(px - 18, py + 15, px - 16, py + 35, px - 10, py + 50);
    ctx.lineTo(px + 10, py + 50);
    ctx.bezierCurveTo(px + 16, py + 35, px + 18, py + 15, px, py);
    ctx.fill();
    
    // 중앙 밝은 부분
    ctx.fillStyle = '#0088ff';
    ctx.beginPath();
    ctx.moveTo(px, py + 5);
    ctx.bezierCurveTo(px - 12, py + 18, px - 10, py + 35, px - 6, py + 48);
    ctx.lineTo(px + 6, py + 48);
    ctx.bezierCurveTo(px + 10, py + 35, px + 12, py + 18, px, py + 5);
    ctx.fill();
    
    // 하이라이트
    ctx.fillStyle = '#33aaff';
    ctx.beginPath();
    ctx.moveTo(px, py + 10);
    ctx.bezierCurveTo(px - 8, py + 20, px - 6, py + 32, px - 3, py + 45);
    ctx.lineTo(px + 3, py + 45);
    ctx.bezierCurveTo(px + 6, py + 32, px + 8, py + 20, px, py + 10);
    ctx.fill();
    
    // 에너지 코어
    const coreGradient = ctx.createRadialGradient(px, py + 25, 0, px, py + 25, 8);
    coreGradient.addColorStop(0, '#ffffff');
    coreGradient.addColorStop(0.4, '#00ffff');
    coreGradient.addColorStop(1, '#0066cc');
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(px, py + 25, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // 코어 빛
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(px - 2, py + 23, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // 콕핏
    const cockpitGradient = ctx.createRadialGradient(px, py + 12, 0, px, py + 12, 5);
    cockpitGradient.addColorStop(0, '#ffffff');
    cockpitGradient.addColorStop(0.5, '#00ffff');
    cockpitGradient.addColorStop(1, '#0066cc');
    ctx.fillStyle = cockpitGradient;
    ctx.beginPath();
    ctx.arc(px, py + 12, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // 엔진 글로우
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(px - 8, py + 46, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + 8, py + 46, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px - 8, py + 46, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + 8, py + 46, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    // 에너지 라인
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(px - 6, py + 15);
    ctx.lineTo(px - 6, py + 40);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + 6, py + 15);
    ctx.lineTo(px + 6, py + 40);
    ctx.stroke();
    ctx.globalAlpha = 1;
    
    ctx.shadowBlur = 0;
}

// 검은 함선 - 최고급형
function drawBlackShip() {
    const px = player.x;
    const py = player.y;
    
    ctx.shadowBlur = 25;
    ctx.shadowColor = 'rgba(255, 0, 0, 0.8)';
    
    // 대형 후면 날개
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(px - 22, py + 25);
    ctx.lineTo(px - 35, py + 42);
    ctx.lineTo(px - 20, py + 42);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(px + 22, py + 25);
    ctx.lineTo(px + 35, py + 42);
    ctx.lineTo(px + 20, py + 42);
    ctx.closePath();
    ctx.fill();
    
    // 날개 빨간 테두리
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px - 22, py + 25);
    ctx.lineTo(px - 35, py + 42);
    ctx.lineTo(px - 20, py + 42);
    ctx.closePath();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(px + 22, py + 25);
    ctx.lineTo(px + 35, py + 42);
    ctx.lineTo(px + 20, py + 42);
    ctx.closePath();
    ctx.stroke();
    
    // 메인 함체 (검은색)
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - 18, py + 45);
    ctx.lineTo(px - 10, py + 52);
    ctx.lineTo(px + 10, py + 52);
    ctx.lineTo(px + 18, py + 45);
    ctx.closePath();
    ctx.fill();
    
    // 어두운 회색 레이어
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(px, py + 5);
    ctx.lineTo(px - 14, py + 45);
    ctx.lineTo(px - 8, py + 50);
    ctx.lineTo(px + 8, py + 50);
    ctx.lineTo(px + 14, py + 45);
    ctx.closePath();
    ctx.fill();
    
    // 중앙 빨간 라인
    ctx.fillStyle = '#660000';
    ctx.beginPath();
    ctx.moveTo(px, py + 8);
    ctx.lineTo(px - 10, py + 45);
    ctx.lineTo(px - 4, py + 48);
    ctx.lineTo(px + 4, py + 48);
    ctx.lineTo(px + 10, py + 45);
    ctx.closePath();
    ctx.fill();
    
    // 빨간 하이라이트
    ctx.fillStyle = '#cc0000';
    ctx.beginPath();
    ctx.moveTo(px, py + 12);
    ctx.lineTo(px - 6, py + 45);
    ctx.lineTo(px + 6, py + 45);
    ctx.closePath();
    ctx.fill();
    
    // 빨간 에너지 코어 (대형)
    const coreGradient = ctx.createRadialGradient(px, py + 22, 0, px, py + 22, 10);
    coreGradient.addColorStop(0, '#ffffff');
    coreGradient.addColorStop(0.3, '#ff0000');
    coreGradient.addColorStop(0.7, '#990000');
    coreGradient.addColorStop(1, '#330000');
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(px, py + 22, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // 코어 내부 빛
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px - 2, py + 20, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(px, py + 22, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // 콕핏 (빨간 빛)
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(px, py + 10, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px - 1, py + 9, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    // 측면 무기 마운트
    ctx.fillStyle = '#333333';
    ctx.fillRect(px - 16, py + 30, 8, 12);
    ctx.fillRect(px + 8, py + 30, 8, 12);
    
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1;
    ctx.strokeRect(px - 16, py + 30, 8, 12);
    ctx.strokeRect(px + 8, py + 30, 8, 12);
    
    // 강력한 엔진 (빨간 글로우)
    const engineGradient = ctx.createRadialGradient(px - 10, py + 48, 0, px - 10, py + 48, 5);
    engineGradient.addColorStop(0, '#ffffff');
    engineGradient.addColorStop(0.4, '#ff0000');
    engineGradient.addColorStop(1, '#660000');
    ctx.fillStyle = engineGradient;
    ctx.beginPath();
    ctx.arc(px - 10, py + 48, 5, 0, Math.PI * 2);
    ctx.fill();
    
    const engineGradient2 = ctx.createRadialGradient(px + 10, py + 48, 0, px + 10, py + 48, 5);
    engineGradient2.addColorStop(0, '#ffffff');
    engineGradient2.addColorStop(0.4, '#ff0000');
    engineGradient2.addColorStop(1, '#660000');
    ctx.fillStyle = engineGradient2;
    ctx.beginPath();
    ctx.arc(px + 10, py + 48, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // 장갑판 디테일
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(px - 12, py + 15 + i * 6);
        ctx.lineTo(px + 12, py + 15 + i * 6);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    
    // 에너지 실드 라인
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(px - 8, py + 15);
    ctx.lineTo(px - 8, py + 45);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + 8, py + 15);
    ctx.lineTo(px + 8, py + 45);
    ctx.stroke();
    ctx.globalAlpha = 1;
    
    ctx.shadowBlur = 0;
}

// 적 그리기 (외계인 우주선)
function drawEnemy(enemy) {
    ctx.save();
    ctx.fillStyle = enemy.color || '#00ff00';
    
    // 적 우주선 몸체
    ctx.beginPath();
    ctx.ellipse(enemy.x, enemy.y, 20, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ff00ff';
    ctx.beginPath();
    ctx.ellipse(enemy.x, enemy.y - 5, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 외계인 눈
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(enemy.x - 4, enemy.y - 5, 2, 0, Math.PI * 2);
    ctx.arc(enemy.x + 4, enemy.y - 5, 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

// 별 그리기
function drawStars() {
    ctx.fillStyle = '#fff';
    stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

// 행성 그리기
function drawPlanets() {
    planets.forEach(planet => {
        ctx.fillStyle = planet.color;
        ctx.beginPath();
        ctx.arc(planet.x, planet.y, planet.size, 0, Math.PI * 2);
        ctx.fill();
        
        // 행성 그림자 효과
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(planet.x + 5, planet.y + 5, planet.size * 0.8, 0, Math.PI * 2);
        ctx.fill();
    });
}

// 키보드 이벤트
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    
    // K키로 공격
    if (e.key.toLowerCase() === 'k' && gameActive) {
        shoot();
    }
    
    // L키로 부스터 (게이지가 있을 때만)
    if (e.key.toLowerCase() === 'l' && gameActive) {
        if (!boosterActive && boosterGauge > 0) {
            boosterActive = true;
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    
    // L키를 떼면 부스터 비활성화
    if (e.key.toLowerCase() === 'l') {
        boosterActive = false;
    }
});

// 플레이어 이동
function movePlayer() {
    const currentSpeed = boosterActive ? player.speed * 1.4 : player.speed;
    
    // 회전 각도 초기화
    let targetRotation = 0;
    
    if (keys['w'] && player.y > 0) {
        player.y -= currentSpeed;
    }
    if (keys['s'] && player.y < canvas.height - player.height) {
        player.y += currentSpeed;
    }
    if (keys['a'] && player.x > 25) {
        player.x -= currentSpeed;
        targetRotation = -0.3; // 왼쪽으로 기울임 (약 17도)
    }
    if (keys['d'] && player.x < canvas.width - 25) {
        player.x += currentSpeed;
        targetRotation = 0.3; // 오른쪽으로 기울임 (약 17도)
    }
    
    // 회전 각도 부드럽게 보간
    player.rotation += (targetRotation - player.rotation) * 0.2;
}

// 위성 생성
function createSatellite() {
    satellites.push({
        angle: (satellites.length * (Math.PI * 2)) / Math.max(1, satellites.length + 1),
        distance: 60,
        lastShot: Date.now()
    });
}

// 위성 업데이트 및 발사
function updateSatellites() {
    const now = Date.now();
    satellites.forEach((satellite, index) => {
        // 위성 회전
        satellite.angle += 0.02;
        
        // 위성 위치 계산
        const satX = player.x + Math.cos(satellite.angle) * satellite.distance;
        const satY = player.y + Math.sin(satellite.angle) * satellite.distance;
        
        // 1초마다 자동 발사
        if (now - satellite.lastShot > 1000) {
            playerBullets.push({
                x: satX,
                y: satY,
                width: 4,
                height: 12,
                speed: 8,
                color: '#00ff00',
                damage: 1,
                type: 'normal'
            });
            satellite.lastShot = now;
        }
    });
}

// 위성 그리기
function drawSatellites() {
    satellites.forEach(satellite => {
        const satX = player.x + Math.cos(satellite.angle) * satellite.distance;
        const satY = player.y + Math.sin(satellite.angle) * satellite.distance;
        
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ff00';
        
        // 위성 본체
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(satX, satY, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // 위성 코어
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(satX, satY, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.restore();
    });
}

// 폭발 생성
function createExplosion(x, y, radius) {
    explosions.push({
        x: x,
        y: y,
        radius: radius,
        maxRadius: radius,
        alpha: 1,
        growing: true
    });
}

// 폭발 업데이트
function updateExplosions() {
    explosions.forEach((explosion, index) => {
        if (explosion.growing) {
            explosion.radius += 5;
            if (explosion.radius >= explosion.maxRadius) {
                explosion.growing = false;
            }
        } else {
            explosion.alpha -= 0.05;
            if (explosion.alpha <= 0) {
                explosions.splice(index, 1);
            }
        }
    });
}

// 폭발 그리기
function drawExplosions() {
    explosions.forEach(explosion => {
        ctx.save();
        ctx.globalAlpha = explosion.alpha;
        
        // 외곽 불꽃
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 중앙 불꽃
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, explosion.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
        
        // 코어
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, explosion.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    });
}

// 플레이어 발사
function shoot() {
    playShootSound(); // 발사 효과음
    
    const effectiveLevel = ((weaponLevel - 1) % 5) + 1; // 5단계마다 리셋
    
    if (effectiveLevel === 1) {
        // 레벨 1: 단일 발사
        playerBullets.push({
            x: player.x,
            y: player.y,
            width: 4,
            height: 15,
            speed: 8,
            color: '#ffff00',
            damage: 1,
            type: 'normal'
        });
    } else if (effectiveLevel === 2) {
        // 레벨 2: 2연발
        playerBullets.push({
            x: player.x - 8,
            y: player.y,
            width: 4,
            height: 15,
            speed: 8,
            color: '#00ffff',
            damage: 1,
            type: 'normal'
        });
        playerBullets.push({
            x: player.x + 8,
            y: player.y,
            width: 4,
            height: 15,
            speed: 8,
            color: '#00ffff',
            damage: 1,
            type: 'normal'
        });
    } else if (effectiveLevel === 3) {
        // 레벨 3: 3연발
        playerBullets.push({
            x: player.x - 12,
            y: player.y,
            width: 5,
            height: 18,
            speed: 9,
            color: '#ff00ff',
            damage: 2,
            type: 'normal'
        });
        playerBullets.push({
            x: player.x,
            y: player.y,
            width: 5,
            height: 18,
            speed: 9,
            color: '#ff00ff',
            damage: 2,
            type: 'normal'
        });
        playerBullets.push({
            x: player.x + 12,
            y: player.y,
            width: 5,
            height: 18,
            speed: 9,
            color: '#ff00ff',
            damage: 2,
            type: 'normal'
        });
    } else if (effectiveLevel === 4) {
        // 레벨 4: 폭발 불꽃 발사
        playerBullets.push({
            x: player.x,
            y: player.y,
            width: 15,
            height: 15,
            speed: 6,
            color: '#ff6600',
            damage: 3,
            type: 'explosive',
            explosionRadius: 60
        });
    }
}

// 부스터 게이지 업데이트
function updateBoosterGauge() {
    if (boosterActive && boosterGauge > 0) {
        // 부스터 사용 중: 게이지 소모
        boosterGauge -= boosterDrainRate;
        if (boosterGauge <= 0) {
            boosterGauge = 0;
            boosterActive = false;
        }
    } else if (!boosterActive && boosterGauge < maxBoosterGauge) {
        // 부스터 미사용: 게이지 충전
        boosterGauge += boosterRechargeRate / 60; // 60fps 기준
        if (boosterGauge > maxBoosterGauge) {
            boosterGauge = maxBoosterGauge;
        }
    }
}

// 체력 아이템 생성
function spawnHealthItem() {
    const currentTime = Date.now();
    if (currentTime - lastHealthItemSpawn > 15000 && gameActive) { // 15초마다
        healthItems.push({
            x: Math.random() * (canvas.width - 40) + 20,
            y: -20,
            width: 25,
            height: 25,
            speed: 2,
            pulse: 0
        });
        lastHealthItemSpawn = currentTime;
    }
}

// 체력 아이템 업데이트
function updateHealthItems() {
    healthItems.forEach((item, index) => {
        item.y += item.speed;
        item.pulse += 0.1;
        
        // 화면 밖으로 나간 아이템 제거
        if (item.y > canvas.height + 50) {
            healthItems.splice(index, 1);
            return;
        }
        
        // 플레이어와 충돌 체크
        if (checkCollision(player, item)) {
            health = Math.min(health + 30, 100); // 최대 100
            playItemSound();
            updateUI();
            healthItems.splice(index, 1);
        }
    });
}

// 체력 아이템 그리기
function drawHealthItems() {
    healthItems.forEach(item => {
        ctx.save();
        
        // 펄스 효과
        const scale = 1 + Math.sin(item.pulse) * 0.2;
        
        // 외곽 빛
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff0000';
        
        // 십자가 모양 (체력 표시)
        ctx.fillStyle = '#ff0000';
        ctx.translate(item.x, item.y);
        ctx.scale(scale, scale);
        
        // 가로 막대
        ctx.fillRect(-10, -3, 20, 6);
        // 세로 막대
        ctx.fillRect(-3, -10, 6, 20);
        
        // 흰색 하이라이트
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-8, -2, 16, 4);
        ctx.fillRect(-2, -8, 4, 16);
        
        ctx.shadowBlur = 0;
        ctx.restore();
    });
}

// 에너지 아이템 생성
function spawnPowerUp() {
    const currentTime = Date.now();
    if (currentTime - lastPowerUpSpawn > 20000 && gameActive) { // 20초마다
        powerUps.push({
            x: Math.random() * (canvas.width - 40) + 20,
            y: -20,
            width: 25,
            height: 25,
            speed: 2,
            rotation: 0
        });
        lastPowerUpSpawn = currentTime;
    }
}

// 에너지 아이템 업데이트
function updatePowerUps() {
    powerUps.forEach((powerUp, index) => {
        powerUp.y += powerUp.speed;
        powerUp.rotation += 0.05;
        
        // 화면 밖으로 나간 아이템 제거
        if (powerUp.y > canvas.height + 50) {
            powerUps.splice(index, 1);
            return;
        }
        
        // 플레이어와 충돌 체크
        if (checkCollision(player, powerUp)) {
            weaponLevel++;
            playItemSound();
            
            // 5의 배수일 때 위성 추가
            if (weaponLevel % 5 === 0) {
                createSatellite();
                addTerminalLine && addTerminalLine(`위성 추가! 총 ${satellites.length}개`, 'terminalSuccess');
            }
            
            const effectiveLevel = ((weaponLevel - 1) % 5) + 1;
            addTerminalLine && addTerminalLine(`무기 레벨: ${weaponLevel} (${effectiveLevel}단계)`, 'terminalSuccess');
            powerUps.splice(index, 1);
        }
    });
}

// 에너지 아이템 그리기
function drawPowerUps() {
    powerUps.forEach(powerUp => {
        ctx.save();
        ctx.translate(powerUp.x, powerUp.y);
        ctx.rotate(powerUp.rotation);
        
        // 외곽 빛
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffaa00';
        
        // 별 모양
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            const radius = i % 2 === 0 ? 12 : 6;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        
        // 중앙 코어
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.restore();
    });
}

// 난이도 설정 함수
function setDifficulty(level) {
    difficulty = level;
    switch(level) {
        case 'easy':
            enemySpawnRate = 0.02 * 0.6; // 60%
            break;
        case 'normal':
            enemySpawnRate = 0.02 * 0.8; // 80%
            break;
        case 'hard':
            enemySpawnRate = 0.02 * 1.25; // 125%
            break;
    }
}

// ========== 보스 시스템 ==========

// 보스 생성
function spawnBoss(level) {
    normalEnemiesDisabled = true;
    bossActive = true;
    
    const bossTypes = {
        0: { // 250점 - "감시자"
            name: '감시자',
            health: 300,
            maxHealth: 300,
            width: 80,
            height: 80,
            color: '#00ffff',
            speed: 2,
            attackPatterns: ['circularShot', 'tracking'],
            attackCooldown: 1000,
            movePattern: 'horizontal'
        },
        1: { // 550점 - "파괴자"
            name: '파괴자',
            health: 500,
            maxHealth: 500,
            width: 100,
            height: 100,
            color: '#ff6600',
            speed: 2.5,
            attackPatterns: ['spreadShot', 'rapidFire'],
            attackCooldown: 800,
            movePattern: 'figure8'
        },
        2: { // 900점 - "혼돈의 군주"
            name: '혼돈의 군주',
            health: 800,
            maxHealth: 800,
            width: 120,
            height: 120,
            color: '#ff00ff',
            speed: 3,
            attackPatterns: ['spiralShot', 'laserBeam', 'circularShot'],
            attackCooldown: 600,
            movePattern: 'aggressive'
        },
        3: { // 1600점 - "차원의 지배자"
            name: '차원의 지배자',
            health: 1200,
            maxHealth: 1200,
            width: 140,
            height: 140,
            color: '#9900ff',
            speed: 3.5,
            attackPatterns: ['teleportAttack', 'waveShot', 'tracking'],
            attackCooldown: 500,
            movePattern: 'teleport'
        },
        4: { // 2500점 - "심연의 왕"
            name: '심연의 왕',
            health: 1800,
            maxHealth: 1800,
            width: 160,
            height: 160,
            color: '#cc0000',
            speed: 4,
            attackPatterns: ['meteorShower', 'laserBeam', 'spiralShot', 'rapidFire'],
            attackCooldown: 400,
            movePattern: 'erratic'
        },
        5: { // 3500점 - "파멸의 신"
            name: '파멸의 신',
            health: 2500,
            maxHealth: 2500,
            width: 180,
            height: 180,
            color: '#000000',
            glowColor: '#ff0000',
            speed: 4.5,
            attackPatterns: ['ultimateAttack', 'meteorShower', 'laserBeam', 'teleportAttack', 'spiralShot'],
            attackCooldown: 300,
            movePattern: 'omnipotent'
        }
    };
    
    const bossData = bossTypes[level];
    
    currentBoss = {
        ...bossData,
        x: canvas.width / 2 - bossData.width / 2,
        y: -bossData.height,
        vx: 0,
        vy: 0,
        phase: 0,
        time: 0,
        lastAttack: Date.now(),
        targetX: canvas.width / 2,
        targetY: 150,
        enraged: false
    };
    
    addTerminalLine && addTerminalLine(`⚠️ 보스 출현: ${bossData.name}! ⚠️`, 'terminalError');
}

// 보스 체크 및 생성
function checkBossSpawn() {
    if (bossActive) return;
    
    for (let i = 0; i < bossSpawnScores.length; i++) {
        if (score >= bossSpawnScores[i] && !defeatedBosses.includes(bossSpawnScores[i])) {
            spawnBoss(i);
            break;
        }
    }
}

// 보스 이동 패턴
function updateBossMovement(boss) {
    boss.time += 0.02;
    
    switch(boss.movePattern) {
        case 'horizontal': // 좌우 이동
            if (boss.y < boss.targetY) {
                boss.y += boss.speed;
            } else {
                boss.x += Math.sin(boss.time * 2) * 3;
            }
            break;
            
        case 'figure8': // 8자 이동
            if (boss.y < boss.targetY) {
                boss.y += boss.speed;
            } else {
                boss.x = canvas.width / 2 + Math.sin(boss.time) * 150;
                boss.y = boss.targetY + Math.sin(boss.time * 2) * 50;
            }
            break;
            
        case 'aggressive': // 공격적인 이동
            if (boss.y < boss.targetY) {
                boss.y += boss.speed;
            } else {
                const dx = player.x - boss.x;
                const dy = player.y - boss.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 200) {
                    boss.x += (dx / dist) * boss.speed * 0.5;
                    boss.y += (dy / dist) * boss.speed * 0.3;
                } else {
                    boss.x += Math.sin(boss.time * 3) * 4;
                }
            }
            break;
            
        case 'teleport': // 순간이동
            if (boss.y < boss.targetY) {
                boss.y += boss.speed;
            } else {
                if (Math.random() < 0.01) {
                    boss.x = Math.random() * (canvas.width - boss.width);
                    boss.y = 50 + Math.random() * 150;
                    createExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2, 50);
                }
            }
            break;
            
        case 'erratic': // 불규칙적 이동
            if (boss.y < boss.targetY) {
                boss.y += boss.speed;
            } else {
                boss.x += Math.sin(boss.time * 4) * 5 + Math.cos(boss.time * 2) * 3;
                boss.y += Math.sin(boss.time * 3) * 2;
                boss.y = Math.max(50, Math.min(boss.y, 250));
            }
            break;
            
        case 'omnipotent': // 최종 보스 이동
            if (boss.y < boss.targetY) {
                boss.y += boss.speed;
            } else {
                boss.x = canvas.width / 2 + Math.sin(boss.time * 1.5) * 200 + Math.cos(boss.time * 3) * 100;
                boss.y = boss.targetY + Math.sin(boss.time * 2) * 70;
                
                if (Math.random() < 0.005) {
                    boss.x = Math.random() * (canvas.width - boss.width);
                }
            }
            break;
    }
    
    // 화면 경계 체크
    boss.x = Math.max(0, Math.min(boss.x, canvas.width - boss.width));
    boss.y = Math.max(0, Math.min(boss.y, canvas.height / 2));
    
    // 분노 모드 (체력 30% 이하)
    if (boss.health < boss.maxHealth * 0.3 && !boss.enraged) {
        boss.enraged = true;
        boss.speed *= 1.3;
        boss.attackCooldown *= 0.7;
        addTerminalLine && addTerminalLine(`${boss.name}이(가) 분노했다!`, 'terminalError');
    }
}

// 보스 공격 패턴
function bossAttack(boss) {
    const now = Date.now();
    if (now - boss.lastAttack < boss.attackCooldown) return;
    
    boss.lastAttack = now;
    const pattern = boss.attackPatterns[Math.floor(Math.random() * boss.attackPatterns.length)];
    
    switch(pattern) {
        case 'circularShot': // 원형 발사
            for (let i = 0; i < 12; i++) {
                const angle = (Math.PI * 2 * i) / 12;
                enemyBullets.push({
                    x: boss.x + boss.width / 2,
                    y: boss.y + boss.height / 2,
                    vx: Math.cos(angle) * 3,
                    vy: Math.sin(angle) * 3,
                    width: 8,
                    height: 8
                });
            }
            break;
            
        case 'tracking': // 추적탄
            for (let i = 0; i < 5; i++) {
                const dx = player.x - boss.x;
                const dy = player.y - boss.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const spread = (i - 2) * 0.3;
                enemyBullets.push({
                    x: boss.x + boss.width / 2,
                    y: boss.y + boss.height / 2,
                    vx: (dx / dist) * 4 + spread,
                    vy: (dy / dist) * 4,
                    width: 10,
                    height: 10,
                    color: '#ff0000'
                });
            }
            break;
            
        case 'spreadShot': // 확산 발사
            for (let i = 0; i < 8; i++) {
                const angle = Math.PI / 2 - Math.PI / 4 + (Math.PI / 2 * i) / 7;
                enemyBullets.push({
                    x: boss.x + boss.width / 2,
                    y: boss.y + boss.height,
                    vx: Math.cos(angle) * 4,
                    vy: Math.sin(angle) * 4,
                    width: 8,
                    height: 8
                });
            }
            break;
            
        case 'rapidFire': // 연속 발사
            for (let i = 0; i < 15; i++) {
                setTimeout(() => {
                    if (currentBoss) {
                        const dx = player.x - currentBoss.x;
                        const dy = player.y - currentBoss.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        enemyBullets.push({
                            x: currentBoss.x + currentBoss.width / 2,
                            y: currentBoss.y + currentBoss.height,
                            vx: (dx / dist) * 5,
                            vy: (dy / dist) * 5,
                            width: 6,
                            height: 6
                        });
                    }
                }, i * 100);
            }
            break;
            
        case 'spiralShot': // 나선 발사
            let spiralAngle = 0;
            for (let i = 0; i < 20; i++) {
                setTimeout(() => {
                    if (currentBoss) {
                        enemyBullets.push({
                            x: currentBoss.x + currentBoss.width / 2,
                            y: currentBoss.y + currentBoss.height / 2,
                            vx: Math.cos(spiralAngle) * 3,
                            vy: Math.sin(spiralAngle) * 3,
                            width: 8,
                            height: 8,
                            color: '#ff00ff'
                        });
                        spiralAngle += Math.PI / 5;
                    }
                }, i * 50);
            }
            break;
            
        case 'laserBeam': // 레이저 빔
            const beamWidth = 30;
            for (let i = 0; i < 10; i++) {
                enemyBullets.push({
                    x: boss.x + boss.width / 2 - beamWidth / 2 + Math.random() * beamWidth,
                    y: boss.y + boss.height,
                    vx: 0,
                    vy: 8,
                    width: 4,
                    height: 20,
                    color: '#ff0000'
                });
            }
            break;
            
        case 'waveShot': // 파동 발사
            for (let i = 0; i < canvas.width; i += 40) {
                enemyBullets.push({
                    x: i,
                    y: boss.y + boss.height,
                    vx: Math.sin(i * 0.1) * 2,
                    vy: 4,
                    width: 8,
                    height: 8,
                    color: '#00ffff'
                });
            }
            break;
            
        case 'teleportAttack': // 순간이동 공격
            createExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2, 30);
            setTimeout(() => {
                if (currentBoss) {
                    currentBoss.x = player.x - currentBoss.width / 2;
                    currentBoss.y = player.y - 200;
                    createExplosion(currentBoss.x + currentBoss.width / 2, currentBoss.y + currentBoss.height / 2, 30);
                    // 원형 폭발
                    for (let i = 0; i < 16; i++) {
                        const angle = (Math.PI * 2 * i) / 16;
                        enemyBullets.push({
                            x: currentBoss.x + currentBoss.width / 2,
                            y: currentBoss.y + currentBoss.height / 2,
                            vx: Math.cos(angle) * 4,
                            vy: Math.sin(angle) * 4,
                            width: 10,
                            height: 10,
                            color: '#9900ff'
                        });
                    }
                }
            }, 500);
            break;
            
        case 'meteorShower': // 운석 낙하
            for (let i = 0; i < 20; i++) {
                setTimeout(() => {
                    enemyBullets.push({
                        x: Math.random() * canvas.width,
                        y: 0,
                        vx: (Math.random() - 0.5) * 2,
                        vy: 6 + Math.random() * 3,
                        width: 12,
                        height: 12,
                        color: '#ff6600'
                    });
                }, i * 150);
            }
            break;
            
        case 'ultimateAttack': // 최종 공격
            // 3단계 복합 공격
            setTimeout(() => {
                // 1단계: 원형 공격
                for (let i = 0; i < 20; i++) {
                    const angle = (Math.PI * 2 * i) / 20;
                    enemyBullets.push({
                        x: boss.x + boss.width / 2,
                        y: boss.y + boss.height / 2,
                        vx: Math.cos(angle) * 5,
                        vy: Math.sin(angle) * 5,
                        width: 12,
                        height: 12,
                        color: '#ff0000'
                    });
                }
            }, 0);
            
            setTimeout(() => {
                // 2단계: 추적탄
                for (let i = 0; i < 10; i++) {
                    const dx = player.x - boss.x;
                    const dy = player.y - boss.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    enemyBullets.push({
                        x: boss.x + boss.width / 2,
                        y: boss.y + boss.height / 2,
                        vx: (dx / dist) * 6,
                        vy: (dy / dist) * 6,
                        width: 10,
                        height: 10,
                        color: '#ffff00'
                    });
                }
            }, 300);
            
            setTimeout(() => {
                // 3단계: 레이저 벽
                for (let i = 0; i < 15; i++) {
                    enemyBullets.push({
                        x: boss.x + boss.width / 2,
                        y: boss.y + boss.height,
                        vx: 0,
                        vy: 10,
                        width: 6,
                        height: 30,
                        color: '#ffffff'
                    });
                }
            }, 600);
            break;
    }
}

// 보스 업데이트
function updateBoss() {
    if (!currentBoss) return;
    
    updateBossMovement(currentBoss);
    bossAttack(currentBoss);
    
    // 플레이어와 충돌 체크
    if (checkCollision(player, currentBoss)) {
        health -= 20;
        playExplosionSound();
        updateUI();
        
        // 플레이어를 밀어냄
        player.x = canvas.width / 2;
        player.y = canvas.height - 100;
        
        if (health <= 0) {
            gameOver();
        }
    }
}

// 보스 그리기
function drawBoss() {
    if (!currentBoss) return;
    
    const boss = currentBoss;
    
    ctx.save();
    
    // 그림자/외광
    ctx.shadowBlur = 30;
    ctx.shadowColor = boss.glowColor || boss.color;
    
    // 보스 본체
    if (boss.glowColor) {
        // 최종 보스는 검은색 + 빨간 외광
        const gradient = ctx.createRadialGradient(
            boss.x + boss.width / 2, 
            boss.y + boss.height / 2, 
            0,
            boss.x + boss.width / 2, 
            boss.y + boss.height / 2, 
            boss.width / 2
        );
        gradient.addColorStop(0, '#330000');
        gradient.addColorStop(0.5, '#000000');
        gradient.addColorStop(1, '#ff0000');
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = boss.color;
    }
    
    // 복잡한 형태
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6 + boss.time;
        const radius = boss.width / 2;
        const x = boss.x + boss.width / 2 + Math.cos(angle) * radius;
        const y = boss.y + boss.height / 2 + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    
    // 중앙 코어
    ctx.fillStyle = boss.enraged ? '#ff0000' : '#ffffff';
    ctx.beginPath();
    ctx.arc(boss.x + boss.width / 2, boss.y + boss.height / 2, boss.width / 4, 0, Math.PI * 2);
    ctx.fill();
    
    // 회전하는 링
    ctx.strokeStyle = boss.enraged ? '#ff0000' : boss.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(boss.x + boss.width / 2, boss.y + boss.height / 2, boss.width / 3, boss.time, boss.time + Math.PI);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    ctx.restore();
    
    // 체력바
    drawBossHealthBar();
}

// 보스 체력바
function drawBossHealthBar() {
    if (!currentBoss) return;
    
    const barWidth = canvas.width - 100;
    const barHeight = 25;
    const barX = 50;
    const barY = 30;
    
    // 배경
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(barX - 5, barY - 5, barWidth + 10, barHeight + 10);
    
    // 체력바 배경
    ctx.fillStyle = '#330000';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // 체력바
    const healthPercent = currentBoss.health / currentBoss.maxHealth;
    const healthBarWidth = barWidth * healthPercent;
    
    const gradient = ctx.createLinearGradient(barX, 0, barX + healthBarWidth, 0);
    if (healthPercent > 0.6) {
        gradient.addColorStop(0, '#00ff00');
        gradient.addColorStop(1, '#ffff00');
    } else if (healthPercent > 0.3) {
        gradient.addColorStop(0, '#ffff00');
        gradient.addColorStop(1, '#ff6600');
    } else {
        gradient.addColorStop(0, '#ff6600');
        gradient.addColorStop(1, '#ff0000');
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, healthBarWidth, barHeight);
    
    // 테두리
    ctx.strokeStyle = currentBoss.enraged ? '#ff0000' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    // 보스 이름 및 체력 텍스트
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
        `${currentBoss.name} ${currentBoss.enraged ? '(분노!)' : ''} - ${Math.ceil(currentBoss.health)} / ${currentBoss.maxHealth}`, 
        canvas.width / 2, 
        barY - 10
    );
}

// 적 생성
function spawnEnemy() {
    if (normalEnemiesDisabled) return; // 보스전 중에는 일반 적 생성 안함
    if (Math.random() < enemySpawnRate && gameActive) {
        const enemyType = Math.random() < 0.5 ? 'straight' : 'diagonal';
        
        const enemy = {
            x: Math.random() * (canvas.width - 40) + 20,
            y: -30,
            width: 40,
            height: 30,
            speed: Math.random() * 1.5 + 1,
            health: 2,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            shootTimer: Math.random() * 100,
            type: enemyType
        };
        
        // 사선형 적의 경우 방향 설정
        if (enemyType === 'diagonal') {
            enemy.horizontalSpeed = (Math.random() - 0.5) * 2; // -1 ~ 1
            enemy.color = '#ff00ff'; // 보라색으로 구분
        }
        
        enemies.push(enemy);
    }
}

// 적 이동 및 공격
function updateEnemies() {
    enemies.forEach((enemy, index) => {
        // 적 타입에 따른 이동
        if (enemy.type === 'straight') {
            // 직선형: 플레이어를 향해 천천히 이동
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            enemy.x += (dx / distance) * enemy.speed * 0.3;
            enemy.y += enemy.speed;
        } else if (enemy.type === 'diagonal') {
            // 사선형: 대각선으로 이동
            enemy.x += enemy.horizontalSpeed * enemy.speed * 0.5;
            enemy.y += enemy.speed;
            
            // 화면 가장자리에 닿으면 방향 반전
            if (enemy.x < 20 || enemy.x > canvas.width - 20) {
                enemy.horizontalSpeed *= -1;
            }
        }
        
        // 적 발사 (빈도 0.8배 = 0.02 * 0.8 = 0.016)
        enemy.shootTimer++;
        if (enemy.shootTimer > 60 && Math.random() < 0.016) {
            enemyBullets.push({
                x: enemy.x,
                y: enemy.y + enemy.height,
                width: 4,
                height: 10,
                speed: 4,
                color: '#ff0000'
            });
            enemy.shootTimer = 0;
        }
        
        // 화면 밖으로 나간 적 제거
        if (enemy.y > canvas.height + 50 || enemy.x < -50 || enemy.x > canvas.width + 50) {
            enemies.splice(index, 1);
        }
        
        // 플레이어와 충돌 체크
        if (checkCollision(player, enemy)) {
            health -= 20;
            enemies.splice(index, 1);
            updateUI();
            if (health <= 0) {
                gameOver();
            }
        }
    });
}

// 총알 업데이트
function updateBullets() {
    // 플레이어 총알 (역순으로 순회하여 splice 문제 방지)
    for (let bIndex = playerBullets.length - 1; bIndex >= 0; bIndex--) {
        const bullet = playerBullets[bIndex];
        
        // 총알 이동
        if (bullet.vx) bullet.x += bullet.vx;
        if (bullet.vy) bullet.y += bullet.vy;
        else bullet.y -= bullet.speed;
        
        // 화면 밖으로 나간 총알 제거
        if (bullet.y < -bullet.height || bullet.x < 0 || bullet.x > canvas.width) {
            playerBullets.splice(bIndex, 1);
            continue;
        }
        
        let bulletRemoved = false;
        
        // 보스와 충돌 체크 (더 정확한 충돌 감지 사용)
        if (currentBoss && checkBossBulletCollision(bullet, currentBoss)) {
            const damage = bullet.damage || 1;
            currentBoss.health -= damage;
            
            // 보스 체력이 0 미만이 되지 않도록
            if (currentBoss.health < 0) currentBoss.health = 0;
            
            // 폭발 효과
            if (bullet.explosive) {
                createExplosion(bullet.x, bullet.y, bullet.explosionRadius);
            }
            
            playerBullets.splice(bIndex, 1);
            bulletRemoved = true;
            
            // 보스 처치
            if (currentBoss.health <= 0) {
                const bossScore = bossSpawnScores[bossSpawnScores.indexOf(defeatedBosses[defeatedBosses.length] || 250)] || 100;
                score += bossScore;
                defeatedBosses.push(bossSpawnScores.find(s => !defeatedBosses.includes(s)));
                
                createExplosion(currentBoss.x + currentBoss.width / 2, currentBoss.y + currentBoss.height / 2, currentBoss.width);
                playExplosionSound();
                addTerminalLine && addTerminalLine(`보스 처치! +${bossScore}점`, 'terminalSuccess');
                
                currentBoss = null;
                bossActive = false;
                normalEnemiesDisabled = false;
                updateUI();
            }
            continue;
        }
        
        // 일반 적과 충돌 체크 (보스가 없거나 보스에 맞지 않았을 때만)
        if (!bulletRemoved) {
            for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex--) {
                const enemy = enemies[eIndex];
                if (checkCollision(bullet, enemy)) {
                    const damage = bullet.damage || 1;
                    enemy.health -= damage;
                    
                    // 폭발 효과
                    if (bullet.explosive) {
                        createExplosion(bullet.x, bullet.y, bullet.explosionRadius);
                        // 주변 적에게도 피해
                        for (let nearIndex = enemies.length - 1; nearIndex >= 0; nearIndex--) {
                            if (nearIndex !== eIndex) {
                                const nearEnemy = enemies[nearIndex];
                                const dx = nearEnemy.x - bullet.x;
                                const dy = nearEnemy.y - bullet.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dist < bullet.explosionRadius) {
                                    nearEnemy.health -= Math.ceil(damage / 2);
                                    if (nearEnemy.health <= 0) {
                                        enemies.splice(nearIndex, 1);
                                        score += 10;
                                        playExplosionSound();
                                        if (nearIndex < eIndex) eIndex--;
                                    }
                                }
                            }
                        }
                    }
                    
                    playerBullets.splice(bIndex, 1);
                    bulletRemoved = true;
                    
                    if (enemy.health <= 0) {
                        enemies.splice(eIndex, 1);
                        score += 10;
                        playExplosionSound();
                        createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 20);
                        updateUI();
                    }
                    break;
                }
            }
        }
    }
    
    // 적 총알 (역순으로 순회)
    for (let index = enemyBullets.length - 1; index >= 0; index--) {
        const bullet = enemyBullets[index];
        
        // 총알 이동
        if (bullet.vx !== undefined) bullet.x += bullet.vx;
        if (bullet.vy !== undefined) bullet.y += bullet.vy;
        else bullet.y += bullet.speed || 5;
        
        // 화면 밖으로 나간 총알 제거
        if (bullet.y > canvas.height || bullet.y < -50 || bullet.x < -50 || bullet.x > canvas.width + 50) {
            enemyBullets.splice(index, 1);
            continue;
        }
        
        // 플레이어와 충돌 체크
        if (checkCollision(bullet, player)) {
            health -= 10;
            enemyBullets.splice(index, 1);
            updateUI();
            if (health <= 0) {
                gameOver();
            }
        }
    }
}

// 충돌 체크
function checkCollision(obj1, obj2) {
    // 더 정확한 충돌 감지를 위해 객체의 실제 위치와 크기 사용
    const obj1Width = obj1.width || 20;
    const obj1Height = obj1.height || 20;
    const obj2Width = obj2.width || 20;
    const obj2Height = obj2.height || 20;
    
    return obj1.x < obj2.x + obj2Width &&
           obj1.x + obj1Width > obj2.x &&
           obj1.y < obj2.y + obj2Height &&
           obj1.y + obj1Height > obj2.y;
}

// 보스와 총알의 더 정확한 충돌 체크 (원형 충돌 + 사각형 충돌 결합)
function checkBossBulletCollision(bullet, boss) {
    // 보스가 화면 밖에 있으면 충돌 없음
    if (boss.y + boss.height < 0 || boss.y > canvas.height) {
        return false;
    }
    
    // 충돌 박스를 더 넓게 확장 (패딩 추가)
    const padding = Math.max(boss.width, boss.height) * 0.15; // 보스 크기의 15% 패딩
    const expandedBossX = boss.x - padding;
    const expandedBossY = boss.y - padding;
    const expandedBossWidth = boss.width + padding * 2;
    const expandedBossHeight = boss.height + padding * 2;
    
    // 먼저 간단한 사각형 충돌 체크 (확장된 박스 사용)
    const bulletRight = bullet.x + (bullet.width || 4);
    const bulletBottom = bullet.y + (bullet.height || 15);
    const bossRight = expandedBossX + expandedBossWidth;
    const bossBottom = expandedBossY + expandedBossHeight;
    
    if (bullet.x < bossRight && bulletRight > expandedBossX &&
        bullet.y < bossBottom && bulletBottom > expandedBossY) {
        // 사각형 충돌이 확인되면 더 정확한 원형 충돌 체크
        const bulletCenterX = bullet.x + (bullet.width || 4) / 2;
        const bulletCenterY = bullet.y + (bullet.height || 15) / 2;
        
        const bossCenterX = boss.x + boss.width / 2;
        const bossCenterY = boss.y + boss.height / 2;
        
        const dx = bulletCenterX - bossCenterX;
        const dy = bulletCenterY - bossCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 보스의 충돌 반경을 더 크게 설정 (대각선 길이의 절반의 120%)
        const bossRadius = Math.sqrt(boss.width * boss.width + boss.height * boss.height) / 2 * 1.2;
        
        // 총알의 반경
        const bulletRadius = Math.max((bullet.width || 4) / 2, (bullet.height || 15) / 2);
        
        return distance < (bossRadius + bulletRadius);
    }
    
    return false;
}

// 배경 업데이트
function updateBackground() {
    // 별 이동
    stars.forEach(star => {
        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    });
    
    // 행성 이동
    planets.forEach(planet => {
        planet.y += planet.speed;
        if (planet.y > canvas.height + planet.size) {
            planet.y = -planet.size;
            planet.x = Math.random() * canvas.width;
        }
    });
}

// 총알 그리기
function drawBullets() {
    // 플레이어 총알
    playerBullets.forEach(bullet => {
        ctx.fillStyle = bullet.color || '#ffff00';
        ctx.fillRect(bullet.x - 2, bullet.y, bullet.width, bullet.height);
        // 총알 빛 효과
        ctx.shadowBlur = 10;
        ctx.shadowColor = bullet.color || '#ffff00';
        ctx.fillRect(bullet.x - 2, bullet.y, bullet.width, bullet.height);
        ctx.shadowBlur = 0;
    });
    
    // 적 총알
    enemyBullets.forEach(bullet => {
        ctx.fillStyle = bullet.color || '#ff0000';
        ctx.shadowBlur = 10;
        ctx.shadowColor = bullet.color || '#ff0000';
        ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
        ctx.shadowBlur = 0;
    });
}

// UI 업데이트
function updateUI() {
    document.getElementById('score').textContent = `점수: ${score}`;
    document.getElementById('health').textContent = `체력: ${health}`;
    document.getElementById('coins').textContent = `💰 코인: ${coins}`;
    
    // 200점마다 5코인 지급
    const coinTier = Math.floor(score / 200);
    const expectedCoins = coinTier * 5;
    if (expectedCoins > lastCoinScore) {
        const earnedCoins = expectedCoins - lastCoinScore;
        coins += earnedCoins;
        lastCoinScore = expectedCoins;
        localStorage.setItem('spaceGameCoins', coins);
        addTerminalLine && addTerminalLine(`💰 +${earnedCoins} 코인 획득!`, 'terminalSuccess');
    }
}

// 리더보드 확인 (상위 10위 안에 드는지)
function isHighScore(newScore) {
    if (leaderboard.length < 10) return true;
    return newScore > leaderboard[leaderboard.length - 1].score;
}

// 리더보드에 점수 추가
function addToLeaderboard(name, playerScore) {
    leaderboard.push({ name: name, score: playerScore });
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 10); // 상위 10개만 유지
    localStorage.setItem('spaceGameLeaderboard', JSON.stringify(leaderboard));
    showLeaderboard();
}

// 리더보드 표시
function showLeaderboard() {
    const leaderboardDiv = document.getElementById('leaderboardList');
    leaderboardDiv.innerHTML = '';
    
    if (leaderboard.length === 0) {
        leaderboardDiv.innerHTML = '<div class="no-records">아직 기록이 없습니다</div>';
        return;
    }
    
    leaderboard.forEach((entry, index) => {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'leaderboard-entry';
        if (index < 3) entryDiv.classList.add(`rank-${index + 1}`);
        
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        entryDiv.innerHTML = `
            <span class="rank">${medal}</span>
            <span class="name">${entry.name}</span>
            <span class="score">${entry.score}</span>
        `;
        leaderboardDiv.appendChild(entryDiv);
    });
}

// 게임 오버
function gameOver() {
    gameActive = false;
    stopBackgroundMusic();
    
    // 높은 점수인지 확인
    if (isHighScore(score)) {
        document.getElementById('nameInput').classList.remove('hidden');
        document.getElementById('nameInputScore').textContent = score;
        document.getElementById('playerNameInput').value = '';
        document.getElementById('playerNameInput').focus();
    } else {
        document.getElementById('gameOver').classList.remove('hidden');
        document.getElementById('finalScore').textContent = score;
        showLeaderboard();
        document.getElementById('leaderboard').classList.remove('hidden');
    }
}

// 이름 제출
function submitName() {
    const nameInput = document.getElementById('playerNameInput');
    const name = nameInput.value.trim() || '익명';
    
    addToLeaderboard(name, score);
    
    document.getElementById('nameInput').classList.add('hidden');
    document.getElementById('gameOver').classList.remove('hidden');
    document.getElementById('finalScore').textContent = score;
    document.getElementById('leaderboard').classList.remove('hidden');
}

// 게임 시작 함수
function startGame(selectedDifficulty) {
    // 난이도 설정
    if (selectedDifficulty) {
        setDifficulty(selectedDifficulty);
    }
    
    gameActive = true;
    gameStarted = true;
    gameStartTime = Date.now();
    lastPowerUpSpawn = Date.now();
    lastHealthItemSpawn = Date.now();
    document.getElementById('startScreen').classList.add('hidden');
    
    // 오디오 초기화 및 배경음악 시작
    initAudio();
    startBackgroundMusic();
}

// 게임 재시작
function restartGame() {
    gameActive = true;
    gameStarted = true;
    gameStartTime = Date.now();
    score = 0;
    health = 100;
    weaponLevel = 1;
    satellites = [];
    enemySpeedMultiplier = 1.0;
    currentBoss = null;
    bossActive = false;
    defeatedBosses = [];
    normalEnemiesDisabled = false;
    lastCoinScore = 0;
    player.x = canvas.width / 2;
    player.y = canvas.height - 80;
    player.rotation = 0; // 회전 초기화
    playerBullets = [];
    enemies = [];
    enemyBullets = [];
    powerUps = [];
    healthItems = [];
    explosions = [];
    boosterActive = false;
    boosterGauge = 100;
    lastPowerUpSpawn = Date.now();
    lastHealthItemSpawn = Date.now();
    
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('leaderboard').classList.add('hidden');
    updateUI();
    
    // 배경음악 재시작
    stopBackgroundMusic();
    setTimeout(() => startBackgroundMusic(), 100);
}

// 부스터 게이지 그리기
function drawBoosterGauge() {
    const gaugeX = 20;
    const gaugeY = canvas.height - 150;
    const gaugeWidth = 30;
    const gaugeHeight = 120;
    
    // 게이지 배경
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(gaugeX, gaugeY, gaugeWidth, gaugeHeight);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(gaugeX, gaugeY, gaugeWidth, gaugeHeight);
    
    // 게이지 채우기
    const fillHeight = (boosterGauge / maxBoosterGauge) * gaugeHeight;
    const gradient = ctx.createLinearGradient(gaugeX, gaugeY + gaugeHeight, gaugeX, gaugeY);
    gradient.addColorStop(0, '#ffaa00');
    gradient.addColorStop(0.5, '#ffff00');
    gradient.addColorStop(1, '#ffffff');
    ctx.fillStyle = gradient;
    ctx.fillRect(gaugeX + 2, gaugeY + gaugeHeight - fillHeight, gaugeWidth - 4, fillHeight);
    
    // 부스터 텍스트
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BOOST', gaugeX + gaugeWidth / 2, gaugeY - 5);
    
    // 퍼센트 표시
    ctx.fillStyle = boosterGauge > 30 ? '#00ff00' : '#ff0000';
    ctx.font = '10px Arial';
    ctx.fillText(`${Math.round(boosterGauge)}%`, gaugeX + gaugeWidth / 2, gaugeY + gaugeHeight + 15);
}

// 무기 레벨 표시
function drawWeaponLevel() {
    const effectiveLevel = ((weaponLevel - 1) % 5) + 1;
    const satelliteCount = satellites.length;
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`무기: Lv.${weaponLevel} (${effectiveLevel}단계)`, 20, canvas.height - 20);
    
    // 레벨별 색상 표시
    const colors = ['#ffff00', '#00ffff', '#ff00ff', '#ff6600', '#00ff00'];
    ctx.fillStyle = colors[effectiveLevel - 1];
    ctx.fillRect(150, canvas.height - 28, 15, 15);
    
    // 위성 표시
    if (satelliteCount > 0) {
        ctx.fillStyle = '#00ff00';
        ctx.fillText(`위성: ×${satelliteCount}`, 180, canvas.height - 20);
    }
}

// 메인 게임 루프
function gameLoop() {
    // 캔버스 클리어
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 배경 항상 그리기
    drawStars();
    drawPlanets();
    updateBackground();
    
    if (gameActive) {
        // 20초마다 적 속도 1.1배 증가
        const elapsedTime = (Date.now() - gameStartTime) / 1000;
        const speedTier = Math.floor(elapsedTime / 20);
        enemySpeedMultiplier = Math.pow(1.1, speedTier);
        
        // 플레이어 업데이트
        movePlayer();
        drawPlayer();
        
        // 위성 업데이트 및 그리기
        updateSatellites();
        drawSatellites();
        
        // 부스터 게이지 업데이트
        updateBoosterGauge();
        
        // 파워업 생성 및 업데이트
        spawnPowerUp();
        updatePowerUps();
        drawPowerUps();
        
        // 체력 아이템 생성 및 업데이트
        spawnHealthItem();
        updateHealthItems();
        drawHealthItems();
        
        // 폭발 효과
        updateExplosions();
        drawExplosions();
        
        // 보스 체크 및 업데이트
        checkBossSpawn();
        if (currentBoss) {
            updateBoss();
            drawBoss();
        }
        
        // 적 생성 및 업데이트
        spawnEnemy();
        updateEnemies();
        enemies.forEach(enemy => drawEnemy(enemy));
        
        // 총알 업데이트
        updateBullets();
        drawBullets();
        
        // UI 그리기
        drawBoosterGauge();
        drawWeaponLevel();
    } else if (!gameStarted) {
        // 시작 화면일 때 플레이어만 보여주기
        drawPlayer();
    }
    
    requestAnimationFrame(gameLoop);
}

// 게임 초기화
function initGame() {
    createStars();
    createPlanets();
    updateUI();
    updateShopUI();
    
    // 이름 입력창에서 Enter 키 처리
    document.getElementById('playerNameInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            submitName();
        }
    });
    
    gameLoop();
}

// 게임 시작
initGame();

// ============================================
// 상점 시스템
// ============================================

// 상점 열기/닫기
function toggleShop() {
    const shop = document.getElementById('shop');
    const isHidden = shop.classList.contains('hidden');
    
    if (isHidden) {
        shop.classList.remove('hidden');
        updateShopUI();
        // 게임 일시정지
        if (gameActive) {
            gameActive = false;
            stopBackgroundMusic();
        }
    } else {
        shop.classList.add('hidden');
        // 게임 재개 (시작 화면이 아니고 게임오버가 아닐 때)
        if (gameStarted && health > 0) {
            gameActive = true;
            startBackgroundMusic();
        }
    }
}

// 상점 UI 업데이트
function updateShopUI() {
    document.getElementById('shopCoins').textContent = coins;
    
    // 각 우주선 카드 상태 업데이트
    const ships = ['red', 'blue', 'black'];
    ships.forEach(shipType => {
        const card = document.querySelector(`.ship-card[data-ship="${shipType}"]`);
        if (!card) return;
        
        const isOwned = ownedShips.includes(shipType);
        const isSelected = currentShip === shipType;
        
        if (isOwned) {
            card.classList.add('owned');
            if (isSelected) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
            
            // 버튼 업데이트
            const btn = card.querySelector('button');
            if (btn) {
                btn.className = 'select-btn';
                btn.textContent = isSelected ? '사용 중' : '선택';
                btn.onclick = () => selectShip(shipType);
                if (isSelected) {
                    btn.classList.add('active');
                }
            }
            
            // 가격 대신 보유 중 표시
            const price = card.querySelector('.ship-price');
            if (price) {
                price.className = 'owned-badge';
                price.textContent = '보유 중';
            }
        } else {
            card.classList.remove('owned', 'selected');
        }
    });
}

// 우주선 구매
function buyShip(shipType, price) {
    if (ownedShips.includes(shipType)) {
        alert('이미 보유한 우주선입니다!');
        return;
    }
    
    if (coins < price) {
        alert(`코인이 부족합니다! (필요: ${price}, 보유: ${coins})`);
        return;
    }
    
    // 구매 확인
    if (!confirm(`${price} 코인으로 이 우주선을 구매하시겠습니까?`)) {
        return;
    }
    
    // 코인 차감
    coins -= price;
    localStorage.setItem('spaceGameCoins', coins);
    
    // 우주선 추가
    ownedShips.push(shipType);
    localStorage.setItem('spaceGameOwnedShips', JSON.stringify(ownedShips));
    
    // 자동 선택
    selectShip(shipType);
    
    // UI 업데이트
    updateShopUI();
    
    alert('구매 완료! 새로운 우주선이 자동으로 선택되었습니다.');
}

// 우주선 선택
function selectShip(shipType) {
    if (!ownedShips.includes(shipType)) {
        alert('보유하지 않은 우주선입니다!');
        return;
    }
    
    currentShip = shipType;
    localStorage.setItem('spaceGameCurrentShip', currentShip);
    
    updateShopUI();
    addTerminalLine && addTerminalLine(`우주선 변경: ${shipType}`, 'terminalSuccess');
}

// ============================================
// 터미널 시스템
// ============================================

let terminalHistory = [];
let historyIndex = -1;

// 터미널 토글
function toggleTerminal() {
    const terminal = document.getElementById('terminal');
    const toggle = document.getElementById('terminalToggle');
    
    if (terminal.classList.contains('hidden')) {
        terminal.classList.remove('hidden');
        toggle.classList.add('hidden');
        document.getElementById('terminalInput').focus();
        addTerminalLine('터미널이 활성화되었습니다. "help"를 입력하여 명령어 목록을 확인하세요.', 'terminalInfo');
    } else {
        terminal.classList.add('hidden');
        toggle.classList.remove('hidden');
    }
}

// 터미널에 라인 추가
function addTerminalLine(text, className = '') {
    const output = document.getElementById('terminalOutput');
    const line = document.createElement('div');
    line.className = `terminalLine ${className}`;
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
}

// 터미널 입력 처리
document.getElementById('terminalInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const input = e.target.value.trim();
        if (input) {
            addTerminalLine(`> ${input}`, 'terminalPromptLine');
            terminalHistory.push(input);
            historyIndex = terminalHistory.length;
            executeCommand(input);
            e.target.value = '';
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex > 0) {
            historyIndex--;
            e.target.value = terminalHistory[historyIndex];
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex < terminalHistory.length - 1) {
            historyIndex++;
            e.target.value = terminalHistory[historyIndex];
        } else {
            historyIndex = terminalHistory.length;
            e.target.value = '';
        }
    }
});

// 명령어 실행
function executeCommand(cmd) {
    const parts = cmd.toLowerCase().split(' ');
    const command = parts[0];
    const args = parts.slice(1);
    
    switch(command) {
        case 'help':
            showHelp();
            break;
        case 'clear':
            document.getElementById('terminalOutput').innerHTML = '';
            break;
        case 'status':
            showStatus();
            break;
        case 'heal':
            healPlayer(args[0]);
            break;
        case 'score':
            addScore(args[0]);
            break;
        case 'speed':
            setSpeed(args[0]);
            break;
        case 'godmode':
            toggleGodMode();
            break;
        case 'kill':
            killAllEnemies();
            break;
        case 'spawn':
            spawnEnemies(args[0]);
            break;
        case 'tp':
        case 'teleport':
            teleportPlayer(args[0], args[1]);
            break;
        case 'invincible':
            toggleInvincible(args[0]);
            break;
        case 'booster':
            boosterGauge = 100;
            addTerminalLine('부스터 게이지가 완전히 충전되었습니다!', 'terminalSuccess');
            break;
        case 'reset':
            restartGame();
            addTerminalLine('게임이 초기화되었습니다.', 'terminalSuccess');
            break;
        case 'music':
            toggleMusic();
            break;
        default:
            addTerminalLine(`알 수 없는 명령어: ${command}. "help"를 입력하여 명령어 목록을 확인하세요.`, 'terminalError');
    }
}

// 도움말
function showHelp() {
    const commands = [
        '=== 사용 가능한 명령어 ===',
        '',
        'help - 명령어 목록 표시',
        'clear - 터미널 화면 지우기',
        'status - 현재 게임 상태 표시',
        '',
        '=== 플레이어 관련 ===',
        'heal [amount] - 체력 회복 (기본: 100)',
        'speed [value] - 이동 속도 변경 (기본: 5)',
        'tp [x] [y] - 플레이어 텔레포트',
        'booster - 부스터 즉시 사용',
        'invincible [duration] - 무적 모드 (초 단위)',
        'godmode - 무적 + 무한 체력 토글',
        '',
        '=== 적 관련 ===',
        'kill - 모든 적 제거',
        'spawn [count] - 적 생성 (기본: 5)',
        '',
        '=== 게임 관련 ===',
        'score [amount] - 점수 추가',
        'music - 배경음악 토글',
        'reset - 게임 초기화',
        '',
    ];
    commands.forEach(line => addTerminalLine(line, 'terminalInfo'));
}

// 상태 표시
function showStatus() {
    addTerminalLine('=== 게임 상태 ===', 'terminalSuccess');
    addTerminalLine(`점수: ${score}`, 'terminalInfo');
    addTerminalLine(`체력: ${health}`, 'terminalInfo');
    addTerminalLine(`게임 활성: ${gameActive ? 'YES' : 'NO'}`, 'terminalInfo');
    addTerminalLine(`플레이어 위치: (${Math.round(player.x)}, ${Math.round(player.y)})`, 'terminalInfo');
    addTerminalLine(`플레이어 속도: ${player.speed}`, 'terminalInfo');
    addTerminalLine(`적 수: ${enemies.length}`, 'terminalInfo');
    addTerminalLine(`부스터 활성: ${boosterActive ? 'YES' : 'NO'}`, 'terminalInfo');
    addTerminalLine(`부스터 쿨타임: ${boosterCooldown ? 'YES' : 'NO'}`, 'terminalInfo');
}

// 체력 회복
function healPlayer(amount) {
    const healAmount = amount ? parseInt(amount) : 100;
    if (isNaN(healAmount)) {
        addTerminalLine('올바른 숫자를 입력하세요.', 'terminalError');
        return;
    }
    health = Math.min(health + healAmount, 100);
    updateUI();
    addTerminalLine(`체력을 ${healAmount}만큼 회복했습니다. 현재 체력: ${health}`, 'terminalSuccess');
}

// 점수 추가
function addScore(amount) {
    const scoreAmount = amount ? parseInt(amount) : 100;
    if (isNaN(scoreAmount)) {
        addTerminalLine('올바른 숫자를 입력하세요.', 'terminalError');
        return;
    }
    score += scoreAmount;
    updateUI();
    addTerminalLine(`점수를 ${scoreAmount}만큼 추가했습니다. 현재 점수: ${score}`, 'terminalSuccess');
}

// 속도 변경
function setSpeed(value) {
    const newSpeed = value ? parseFloat(value) : 5;
    if (isNaN(newSpeed) || newSpeed <= 0) {
        addTerminalLine('올바른 숫자를 입력하세요. (양수)', 'terminalError');
        return;
    }
    player.speed = newSpeed;
    addTerminalLine(`이동 속도를 ${newSpeed}로 설정했습니다.`, 'terminalSuccess');
}

// 갓모드 토글
let godMode = false;
function toggleGodMode() {
    godMode = !godMode;
    if (godMode) {
        health = 9999;
        updateUI();
        addTerminalLine('갓모드 활성화! 무적 상태입니다.', 'terminalSuccess');
    } else {
        health = 100;
        updateUI();
        addTerminalLine('갓모드 비활성화.', 'terminalInfo');
    }
}

// 모든 적 제거
function killAllEnemies() {
    const count = enemies.length;
    enemies = [];
    enemyBullets = [];
    addTerminalLine(`${count}개의 적을 제거했습니다.`, 'terminalSuccess');
}

// 적 생성 (터미널용)
function spawnEnemies(count) {
    const spawnCount = count ? parseInt(count) : 5;
    if (isNaN(spawnCount) || spawnCount <= 0) {
        addTerminalLine('올바른 숫자를 입력하세요. (양수)', 'terminalError');
        return;
    }
    for (let i = 0; i < spawnCount; i++) {
        const enemyType = Math.random() < 0.5 ? 'straight' : 'diagonal';
        
        const enemy = {
            x: Math.random() * (canvas.width - 40) + 20,
            y: Math.random() * 200 - 100,
            width: 40,
            height: 30,
            speed: Math.random() * 1.5 + 1,
            health: 2,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            shootTimer: Math.random() * 100,
            type: enemyType
        };
        
        // 사선형 적의 경우 방향 설정
        if (enemyType === 'diagonal') {
            enemy.horizontalSpeed = (Math.random() - 0.5) * 2;
            enemy.color = '#ff00ff';
        }
        
        enemies.push(enemy);
    }
    addTerminalLine(`${spawnCount}개의 적을 생성했습니다.`, 'terminalSuccess');
}

// 텔레포트
function teleportPlayer(x, y) {
    const newX = x ? parseInt(x) : canvas.width / 2;
    const newY = y ? parseInt(y) : canvas.height - 80;
    
    if (isNaN(newX) || isNaN(newY)) {
        addTerminalLine('올바른 좌표를 입력하세요.', 'terminalError');
        return;
    }
    
    player.x = Math.max(25, Math.min(newX, canvas.width - 25));
    player.y = Math.max(0, Math.min(newY, canvas.height - player.height));
    addTerminalLine(`플레이어를 (${Math.round(player.x)}, ${Math.round(player.y)})로 텔레포트했습니다.`, 'terminalSuccess');
}

// 무적 모드
let invincibleMode = false;
let invincibleTimeout = null;
function toggleInvincible(duration) {
    const time = duration ? parseInt(duration) : 10;
    if (isNaN(time) || time <= 0) {
        addTerminalLine('올바른 시간을 입력하세요. (초 단위, 양수)', 'terminalError');
        return;
    }
    
    invincibleMode = true;
    addTerminalLine(`${time}초간 무적 상태입니다!`, 'terminalSuccess');
    
    if (invincibleTimeout) clearTimeout(invincibleTimeout);
    invincibleTimeout = setTimeout(() => {
        invincibleMode = false;
        addTerminalLine('무적 모드가 종료되었습니다.', 'terminalInfo');
    }, time * 1000);
}

// 배경음악 토글
function toggleMusic() {
    if (bgMusic.paused) {
        bgMusic.play();
        addTerminalLine('배경음악을 재생합니다.', 'terminalSuccess');
    } else {
        bgMusic.pause();
        addTerminalLine('배경음악을 일시정지합니다.', 'terminalInfo');
    }
}

// 갓모드 및 무적 모드 적용
const originalUpdateEnemies = updateEnemies;
updateEnemies = function() {
    enemies.forEach((enemy, index) => {
        // 적 타입에 따른 이동
        if (enemy.type === 'straight') {
            // 직선형: 플레이어를 향해 천천히 이동
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            enemy.x += (dx / distance) * enemy.speed * 0.3;
            enemy.y += enemy.speed;
        } else if (enemy.type === 'diagonal') {
            // 사선형: 대각선으로 이동
            enemy.x += enemy.horizontalSpeed * enemy.speed * 0.5;
            enemy.y += enemy.speed;
            
            // 화면 가장자리에 닿으면 방향 반전
            if (enemy.x < 20 || enemy.x > canvas.width - 20) {
                enemy.horizontalSpeed *= -1;
            }
        }
        
        // 적 발사 (빈도 0.8배 = 0.02 * 0.8 = 0.016)
        enemy.shootTimer++;
        if (enemy.shootTimer > 60 && Math.random() < 0.016) {
            enemyBullets.push({
                x: enemy.x,
                y: enemy.y + enemy.height,
                width: 4,
                height: 10,
                speed: 4,
                color: '#ff0000'
            });
            enemy.shootTimer = 0;
        }
        
        // 화면 밖으로 나간 적 제거
        if (enemy.y > canvas.height + 50 || enemy.x < -50 || enemy.x > canvas.width + 50) {
            enemies.splice(index, 1);
        }
        
        // 플레이어와 충돌 체크 (갓모드/무적 모드가 아닐 때만)
        if (!godMode && !invincibleMode && checkCollision(player, enemy)) {
            health -= 20;
            playExplosionSound(); // 폭발 효과음
            enemies.splice(index, 1);
            updateUI();
            if (health <= 0) {
                gameOver();
            }
        }
    });
};

const originalUpdateBullets = updateBullets;
updateBullets = function() {
    // 플레이어 총알
    playerBullets.forEach((bullet, bIndex) => {
        bullet.y -= bullet.speed;
        
        // 화면 밖으로 나간 총알 제거
        if (bullet.y < -bullet.height) {
            playerBullets.splice(bIndex, 1);
            return;
        }
        
        // 적과 충돌 체크
        enemies.forEach((enemy, eIndex) => {
            if (checkCollision(bullet, enemy)) {
                enemy.health -= bullet.damage || 1;
                playerBullets.splice(bIndex, 1);
                
                if (enemy.health <= 0) {
                    playExplosionSound(); // 폭발 효과음
                    enemies.splice(eIndex, 1);
                    score += 10;
                    updateUI();
                }
            }
        });
    });
    
    // 적 총알
    enemyBullets.forEach((bullet, index) => {
        bullet.y += bullet.speed;
        
        // 화면 밖으로 나간 총알 제거
        if (bullet.y > canvas.height) {
            enemyBullets.splice(index, 1);
            return;
        }
        
        // 플레이어와 충돌 체크 (갓모드/무적 모드가 아닐 때만)
        if (!godMode && !invincibleMode && checkCollision(bullet, player)) {
            health -= 10;
            enemyBullets.splice(index, 1);
            updateUI();
            if (health <= 0) {
                gameOver();
            }
        }
    });
};

// 갓모드 시 체력 유지
const originalUpdateUI = updateUI;
updateUI = function() {
    if (godMode && health < 9999) {
        health = 9999;
    }
    document.getElementById('score').textContent = `점수: ${score}`;
    document.getElementById('health').textContent = `체력: ${health}`;
};

// ` 키로 터미널 토글
document.addEventListener('keydown', (e) => {
    if (e.key === '`' || e.key === '~') {
        e.preventDefault();
        toggleTerminal();
    }
});

