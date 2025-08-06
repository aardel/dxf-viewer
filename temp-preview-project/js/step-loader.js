// Step Loader Module for NC File Viewer
// Provides advanced line-by-line visualization controls

const StepLoader = {
  state: {
    currentLine: 0,
    totalLines: 0,
    playing: false,
    playInterval: null,
    lines: [],
    onStep: null // callback to update visualization
  },

  init: function(lines, onStep) {
    this.state.lines = lines;
    this.state.totalLines = lines.length;
    this.state.currentLine = 0;
    this.state.playing = false;
    this.state.onStep = onStep;
    this.update();
  },

  stepForward: function() {
    if (this.state.currentLine < this.state.totalLines - 1) {
      this.state.currentLine++;
      this.update();
    }
  },

  stepBackward: function() {
    if (this.state.currentLine > 0) {
      this.state.currentLine--;
      this.update();
    }
  },

  play: function(speed = 250) {
    if (this.state.playing) return;
    this.state.playing = true;
    this.state.playInterval = setInterval(() => {
      if (this.state.currentLine < this.state.totalLines - 1) {
        this.state.currentLine++;
        this.update();
      } else {
        this.pause();
      }
    }, speed);
  },

  pause: function() {
    this.state.playing = false;
    if (this.state.playInterval) {
      clearInterval(this.state.playInterval);
      this.state.playInterval = null;
    }
  },

  reset: function() {
    this.state.currentLine = 0;
    this.pause();
    this.update();
  },

  update: function() {
    if (typeof this.state.onStep === 'function') {
      this.state.onStep(this.state.lines.slice(0, this.state.currentLine + 1), this.state.currentLine);
    }
  }
};

window.StepLoader = StepLoader;
