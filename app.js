const ACTIONS = ["caminar", "saltar", "correr"];

const AGENT_TEMPLATES = [
  {
    id: "aracnida",
    name: "Astra la araña",
    body: "Artrópodo veloz con patas elásticas.",
    color: "#d86dff",
    shape: "spider"
  },
  {
    id: "humanoide",
    name: "Neo humanoide",
    body: "Bípedo equilibrado en aprendizaje.",
    color: "#54cbff",
    shape: "human"
  },
  {
    id: "zorro",
    name: "Luma zorro",
    body: "Animal ágil con sprint potente.",
    color: "#ff9a4a",
    shape: "fox"
  },
  {
    id: "gecko",
    name: "Pixel gecko",
    body: "Reptil curioso de saltos largos.",
    color: "#79ef91",
    shape: "gecko"
  }
];

const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");

const state = {
  running: false,
  config: {
    episodes: 600,
    speed: 20,
    epsilon: 0.4,
    difficulty: "normal"
  },
  env: null,
  agents: []
};

class RLRunner {
  constructor(template) {
    this.template = template;
    this.q = new Map();
    this.alpha = 0.2;
    this.gamma = 0.93;
    this.resetStats();
  }

  resetStats() {
    this.position = 0;
    this.velocityY = 0;
    this.episode = 0;
    this.step = 0;
    this.rewardSum = 0;
    this.successCount = 0;
    this.lastReward = 0;
    this.lastAction = "caminar";
    this.done = false;
  }

  qRow(key) {
    if (!this.q.has(key)) {
      this.q.set(key, ACTIONS.map(() => 0));
    }
    return this.q.get(key);
  }

  stateKey(env) {
    const zone = Math.floor(this.position / env.segmentLength);
    const nearest = env.obstacles.find((o) => o.x > this.position);
    const distance = nearest ? Math.max(0, Math.floor((nearest.x - this.position) / 8)) : 12;
    const inAir = this.velocityY !== 0 ? 1 : 0;
    return `${zone}|${Math.min(distance, 12)}|${inAir}`;
  }

  chooseAction(env, epsilon) {
    const key = this.stateKey(env);
    if (Math.random() < epsilon) {
      return { actionIdx: Math.floor(Math.random() * ACTIONS.length), key };
    }
    const values = this.qRow(key);
    let best = 0;
    for (let i = 1; i < values.length; i += 1) {
      if (values[i] > values[best]) best = i;
    }
    return { actionIdx: best, key };
  }

  applyPhysics(action, env) {
    const base = { caminar: 3, correr: 6, saltar: 4 };
    let forward = base[action];

    if (action === "saltar" && this.velocityY === 0) {
      this.velocityY = -10;
      forward = 4.5;
    }

    this.velocityY += 0.85;
    const y = Math.min(0, this.velocityY);
    const onGround = this.velocityY >= 0;
    if (onGround) this.velocityY = 0;

    this.position += forward;
    this.position = Math.max(0, Math.min(env.goalX, this.position));
    return y;
  }

  computeReward(env) {
    let reward = 0.2;
    const nearest = env.obstacles.find((o) => Math.abs(o.x - this.position) < 12);
    if (nearest && this.velocityY === 0) reward -= 7;
    if (this.lastAction === "correr" && this.position > env.goalX * 0.7) reward += 0.3;
    if (this.lastAction === "saltar" && !nearest) reward += 0.2;
    if (this.position >= env.goalX) {
      reward += 12;
      this.successCount += 1;
      this.done = true;
    }
    reward -= 0.02;
    return reward;
  }

  tick(env, epsilon) {
    if (this.done) {
      this.startEpisode();
      return;
    }

    this.step += 1;
    const { actionIdx, key } = this.chooseAction(env, epsilon);
    this.lastAction = ACTIONS[actionIdx];
    this.applyPhysics(this.lastAction, env);

    const reward = this.computeReward(env);
    this.lastReward = reward;
    this.rewardSum += reward;

    const nextKey = this.stateKey(env);
    const row = this.qRow(key);
    const next = this.qRow(nextKey);
    const bestNext = Math.max(...next);
    row[actionIdx] = row[actionIdx] + this.alpha * (reward + this.gamma * bestNext - row[actionIdx]);

    if (this.step > env.maxSteps) this.done = true;
    if (this.done) this.startEpisode();
  }

  startEpisode() {
    this.episode += 1;
    this.position = 0;
    this.velocityY = 0;
    this.step = 0;
    this.done = false;
  }

  successRate() {
    if (this.episode === 0) return 0;
    return Math.round((this.successCount / this.episode) * 100);
  }
}

function buildEnvironment(difficulty) {
  const byDifficulty = {
    easy: [180, 350, 520, 700],
    normal: [150, 280, 420, 560, 710],
    hard: [120, 220, 340, 460, 600, 710]
  };
  return {
    goalX: 780,
    segmentLength: 78,
    maxSteps: difficulty === "hard" ? 250 : 320,
    obstacles: byDifficulty[difficulty].map((x, i) => ({ x, h: 16 + (i % 3) * 10 }))
  };
}

function createAgents() {
  state.agents = AGENT_TEMPLATES.map((tpl) => new RLRunner(tpl));
}

function drawAgent(agent, yBase) {
  const x = 25 + agent.position;
  ctx.save();
  ctx.translate(x, yBase);
  ctx.fillStyle = agent.template.color;
  ctx.strokeStyle = "#ffffffaa";
  ctx.lineWidth = 1.2;

  if (agent.template.shape === "spider") {
    ctx.beginPath();
    ctx.arc(0, -12, 10, 0, Math.PI * 2);
    ctx.fill();
    for (let i = -1; i <= 1; i += 2) {
      for (let j = 0; j < 4; j += 1) {
        ctx.beginPath();
        ctx.moveTo(i * 6, -12 + j * 2);
        ctx.lineTo(i * (13 + j * 2), -7 + j * 4);
        ctx.stroke();
      }
    }
  } else if (agent.template.shape === "human") {
    ctx.beginPath();
    ctx.arc(0, -18, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-5, -12, 10, 16);
    ctx.fillRect(-10, -2, 7, 4);
    ctx.fillRect(3, -2, 7, 4);
    ctx.fillRect(-6, 4, 4, 10);
    ctx.fillRect(2, 4, 4, 10);
  } else if (agent.template.shape === "fox") {
    ctx.beginPath();
    ctx.ellipse(0, -10, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-12, -11);
    ctx.lineTo(-22, -14);
    ctx.lineTo(-18, -6);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-8, -4, 4, 9);
    ctx.fillRect(4, -4, 4, 9);
  } else {
    ctx.fillRect(-12, -11, 24, 10);
    ctx.fillRect(-15, -9, 3, 7);
    ctx.fillRect(12, -9, 3, 7);
    ctx.fillRect(-8, -1, 5, 8);
    ctx.fillRect(3, -1, 5, 8);
    ctx.beginPath();
    ctx.arc(-5, -7, 1.5, 0, Math.PI * 2);
    ctx.arc(5, -7, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }

  ctx.restore();
}

function drawWorld() {
  const { env } = state;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const groundY = canvas.height - 60;
  ctx.fillStyle = "#8fd2ff";
  ctx.fillRect(0, 0, canvas.width, 70);

  ctx.fillStyle = "#1b2f58";
  for (let i = 0; i < 5; i += 1) {
    ctx.fillRect(i * 220, 80 + (i % 2) * 15, 190, 24);
  }

  ctx.fillStyle = "#2d4f8b";
  ctx.fillRect(0, groundY, canvas.width, 80);

  ctx.fillStyle = "#ea7488";
  env.obstacles.forEach((obs) => {
    ctx.fillRect(25 + obs.x, groundY - obs.h, 18, obs.h);
  });

  ctx.fillStyle = "#66e69c";
  ctx.fillRect(25 + env.goalX, groundY - 62, 10, 62);
  ctx.fillStyle = "#d9fff1";
  ctx.fillText("META", 25 + env.goalX - 8, groundY - 72);

  state.agents.forEach((agent, idx) => drawAgent(agent, groundY - idx * 58));
}

function renderCards() {
  const host = document.getElementById("agentCards");
  host.innerHTML = "";
  const tpl = document.getElementById("agentCardTemplate");

  state.agents.forEach((agent) => {
    const card = tpl.content.firstElementChild.cloneNode(true);
    card.querySelector("h3").textContent = agent.template.name;
    card.querySelector(".agent-desc").textContent = agent.template.body;
    card.querySelector(".swatch").style.background = agent.template.color;
    card.querySelector(".episode").textContent = String(agent.episode);
    card.querySelector(".reward").textContent = agent.lastReward.toFixed(2);
    card.querySelector(".success").textContent = `${agent.successRate()}%`;
    host.appendChild(card);
  });
}

function updateStatus() {
  const best = [...state.agents].sort((a, b) => b.successRate() - a.successRate())[0];
  document.getElementById("statusText").textContent = state.running
    ? `Entrenando... líder: ${best.template.name} (${best.successRate()}% de éxito). Acción reciente: ${best.lastAction}.`
    : "Pausado o listo para iniciar.";
}

function setupInputs() {
  const sync = (id, output, parser = Number, fmt = (v) => v) => {
    const input = document.getElementById(id);
    const out = document.getElementById(output);
    const apply = () => {
      const value = parser(input.value);
      state.config[id] = value;
      out.textContent = fmt(value);
    };
    input.addEventListener("input", apply);
    apply();
  };

  sync("episodes", "episodesValue");
  sync("speed", "speedValue");
  sync("epsilon", "epsilonValue", Number, (v) => v.toFixed(2));

  document.getElementById("difficulty").addEventListener("change", (e) => {
    state.config.difficulty = e.target.value;
  });
}

function resetSimulation() {
  state.env = buildEnvironment(state.config.difficulty);
  createAgents();
  drawWorld();
  renderCards();
  updateStatus();
}

let lastFrame = 0;
function loop(ts) {
  const delta = ts - lastFrame;
  const interval = 1000 / state.config.speed;

  if (state.running && delta > interval) {
    lastFrame = ts;
    state.agents.forEach((agent) => {
      const scheduleFactor = Math.max(1, Math.round(state.config.episodes / 200));
      for (let i = 0; i < scheduleFactor; i += 1) {
        if (agent.episode >= state.config.episodes) {
          state.running = false;
          break;
        }
        agent.tick(state.env, state.config.epsilon);
      }
    });
    drawWorld();
    renderCards();
    updateStatus();
  }
  requestAnimationFrame(loop);
}

function bindButtons() {
  document.getElementById("toggleConfig").addEventListener("click", () => {
    document.getElementById("configPanel").classList.toggle("hidden");
  });

  document.getElementById("startBtn").addEventListener("click", () => {
    state.env = buildEnvironment(state.config.difficulty);
    state.running = true;
    updateStatus();
  });

  document.getElementById("pauseBtn").addEventListener("click", () => {
    state.running = !state.running;
    updateStatus();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    state.running = false;
    resetSimulation();
  });
}

setupInputs();
bindButtons();
resetSimulation();
requestAnimationFrame(loop);
