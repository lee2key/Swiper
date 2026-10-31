const state = {
  photos: [],
  pairs: [],
  currentPair: 0,
  round: 1,
  mode: 'random',
  advancingPhotos: null,
  roundWinners: [],
};

const elements = {
  welcome: document.querySelector('#welcome'), duel: document.querySelector('#duel'), results: document.querySelector('#results'),
  sessionInfo: document.querySelector('#sessionInfo'), roundLabel: document.querySelector('#roundLabel'), progressLabel: document.querySelector('#progressLabel'),
  leftMedia: document.querySelector('#leftMedia'), rightMedia: document.querySelector('#rightMedia'),
  leftChoice: document.querySelector('#leftChoice'), rightChoice: document.querySelector('#rightChoice'),
  leftSelect: document.querySelector('#leftSelect'), rightSelect: document.querySelector('#rightSelect'),
  ranking: document.querySelector('#ranking'), resultTitle: document.querySelector('#resultTitle'), resultMessage: document.querySelector('#resultMessage'),
  modeSelect: document.querySelector('#modeSelect'), nextRoundButton: document.querySelector('#nextRoundButton'),
};

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildPairs(contenders) {
  const order = shuffle(contenders);
  state.pairs = [];
  for (let i = 0; i < order.length - 1; i += 2) state.pairs.push([order[i], order[i + 1]]);
  state.roundWinners = state.mode === 'winner' && order.length % 2 ? [order[order.length - 1]] : [];
  state.currentPair = 0;
}

function showPair() {
  const pair = state.pairs[state.currentPair];
  if (!pair) {
    if (state.mode === 'winner') state.advancingPhotos = state.roundWinners;
    return showResults();
  }
  renderMedia(elements.leftMedia, pair[0]);
  renderMedia(elements.rightMedia, pair[1]);
  elements.roundLabel.textContent = `Round ${state.round}`;
  elements.progressLabel.textContent = `${state.currentPair + 1} / ${state.pairs.length} duels`;
}

function renderMedia(container, photo) {
  container._videoFitObserver?.disconnect();
  const media = document.createElement(photo.type === 'video' ? 'video' : 'div');
  media.className = `duel-media ${photo.type}`;
  if (photo.type === 'video') {
    media.controls = true;
    media.preload = 'metadata';
    media.setAttribute('aria-label', `Play ${photo.name}`);
    fitVideoToStage(media, container);
    media.src = photo.url;
    // Video controls must not accidentally submit a choice.
    ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'keydown'].forEach((eventName) => media.addEventListener(eventName, (event) => event.stopPropagation()));
  } else {
    media.style.backgroundImage = `url(${JSON.stringify(photo.url)})`;
    media.setAttribute('role', 'img');
    media.setAttribute('aria-label', photo.name);
  }
  container.replaceChildren(media);
}

function fitVideoToStage(video, stage) {
  const fit = () => {
    if (!video.videoWidth || !video.videoHeight) return;
    const { width: stageWidth, height: stageHeight } = stage.getBoundingClientRect();
    if (!stageWidth || !stageHeight) return;

    // Scale by the largest native dimension that can fit within both frame dimensions.
    const scale = Math.min(stageWidth / video.videoWidth, stageHeight / video.videoHeight);
    video.style.width = `${Math.floor(video.videoWidth * scale)}px`;
    video.style.height = `${Math.floor(video.videoHeight * scale)}px`;
  };

  const observer = new ResizeObserver(fit);
  stage._videoFitObserver = observer;
  observer.observe(stage);
  video.addEventListener('loadedmetadata', fit);
  video.addEventListener('emptied', () => {
    observer.disconnect();
    if (stage._videoFitObserver === observer) delete stage._videoFitObserver;
  }, { once: true });
}

function choose(side) {
  const pair = state.pairs[state.currentPair];
  if (!pair) return;
  const winner = pair[side];
  winner.points += 1;
  if (state.mode === 'winner') state.roundWinners.push(winner);
  state.currentPair += 1;
  showPair();
}

function showResults() {
  elements.duel.hidden = true;
  elements.results.hidden = false;
  const winnerFinished = state.mode === 'winner' && state.advancingPhotos?.length === 1;
  if (state.mode === 'winner') {
    elements.resultTitle.textContent = winnerFinished ? 'Your winner is ready' : `Round ${state.round} is complete`;
    elements.resultMessage.textContent = winnerFinished
      ? 'Every file is shown below, ranked by the points it earned.'
      : `${state.advancingPhotos.length} ${state.advancingPhotos.length === 1 ? 'file advances' : 'files advance'} to the next round.`;
  } else {
    elements.resultTitle.textContent = state.round === 1 ? 'Your first ranking is ready' : `Round ${state.round} is complete`;
    elements.resultMessage.textContent = 'Start another round to give the leading photos more chances to pull ahead.';
  }
  elements.nextRoundButton.hidden = winnerFinished;
  const sorted = [...state.photos].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  elements.ranking.replaceChildren(...sorted.map((photo, index) => {
    const item = document.createElement('article');
    item.className = 'rank-item';
    const thumbnail = photo.type === 'video'
      ? `<video src="${photo.url}" preload="metadata" muted aria-label="${escapeHtml(photo.name)}"></video>`
      : `<img src="${photo.url}" alt="${escapeHtml(photo.name)}">`;
    item.innerHTML = `<span class="rank-number">${index + 1}</span>${thumbnail}<div class="rank-copy"><strong>${escapeHtml(photo.name)}</strong><span>${photo.type === 'video' ? 'Video · ' : ''}${photo.points} ${photo.points === 1 ? 'point' : 'points'}</span></div>`;
    item.title = 'Show this file in Explorer';
    item.addEventListener('click', () => window.swiper.revealInExplorer(photo.id));
    return item;
  }));
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

async function chooseFolder() {
  const selection = await window.swiper.chooseFolder();
  if (!selection) return;
  if (selection.photos.length < 2) {
    window.alert('Choose a folder that contains at least two supported image files.');
    return;
  }
  state.photos = selection.photos.map((photo) => ({ ...photo, points: 0 }));
  state.round = 1;
  state.advancingPhotos = null;
  startRound();
}

function startRound() {
  const contenders = state.mode === 'winner' ? (state.advancingPhotos || state.photos) : state.photos;
  if (contenders.length < 2) return showResults();
  buildPairs(contenders);
  elements.welcome.hidden = true;
  elements.results.hidden = true;
  elements.duel.hidden = false;
  elements.sessionInfo.hidden = false;
  showPair();
}

document.querySelector('#startButton').addEventListener('click', chooseFolder);
document.querySelector('#folderButton').addEventListener('click', chooseFolder);
elements.nextRoundButton.addEventListener('click', () => { state.round += 1; startRound(); });
document.querySelector('#renameButton').addEventListener('click', renameRankedFiles);
elements.modeSelect.addEventListener('change', () => {
  state.mode = elements.modeSelect.value;
  if (!state.photos.length) return;
  state.photos.forEach((photo) => { photo.points = 0; });
  state.round = 1;
  state.advancingPhotos = null;
  startRound();
});
elements.leftChoice.addEventListener('click', () => choose(0));
elements.rightChoice.addEventListener('click', () => choose(1));
elements.leftSelect.addEventListener('click', () => choose(0));
elements.rightSelect.addEventListener('click', () => choose(1));
elements.leftChoice.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(0); }
});
elements.rightChoice.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(1); }
});
window.addEventListener('keydown', (event) => {
  if (!elements.results.hidden && !elements.nextRoundButton.hidden && event.key === 'Enter') {
    event.preventDefault();
    elements.nextRoundButton.click();
    return;
  }
  if (elements.duel.hidden) return;
  if (event.key === 'ArrowLeft') choose(0);
  if (event.key === 'ArrowRight') choose(1);
});

async function renameRankedFiles() {
  const sorted = [...state.photos].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const confirmed = window.confirm(
    `Rename ${sorted.length} files using their current ranking?\n\nFor example: image.png becomes 001_image.png.`,
  );
  if (!confirmed) return;

  const renameButton = document.querySelector('#renameButton');
  renameButton.disabled = true;
  renameButton.textContent = 'Renaming…';
  try {
    const renamed = await window.swiper.renameRanked(sorted.map((photo) => photo.id));
    const changedPaths = new Map(renamed.map((item) => [item.oldPath, item]));
    state.photos = state.photos.map((photo) => {
      const changed = changedPaths.get(photo.id);
      return changed ? { ...photo, id: changed.newPath, name: changed.name, url: changed.url } : photo;
    });
    showResults();
    window.alert('Files were renamed with their current ranking.');
  } catch (error) {
    window.alert(`Files were not renamed.\n\n${error.message}`);
  } finally {
    renameButton.disabled = false;
    renameButton.textContent = 'Rename files';
  }
}
