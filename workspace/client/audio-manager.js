const howler = require('howler');
const audioManager = {};
audioManager.init = () => {
  const sound = new howler.Sound('sound.mp3');
audioManager.init = () => {
  // Initialize the audio manager
  console.log('Audio manager initialized');
};
};
audioManager.playSound = () => {
  sound.play();
audioManager.playSound = () => {
  // Play a sound
  console.log('Sound played');
};
};
module.exports = audioManager;