export default {
  base: './',
  build: {
    chunkSizeWarningLimit: 2200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          simulationSupport: ['phaser'],
          geography: ['./src/generated/sectors.json'],
        },
      },
    },
  },
};
