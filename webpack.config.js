const path = require('path');

module.exports = {
    // Define the mode as development
    mode: 'development',

    // Entry point of your application
    entry: './src/index.ts',
    
    // Output configuration
    output: {
        filename: 'miniviewer.js',
        path: path.resolve(__dirname, 'dist'),
    },
    resolve: {
      extensions: [".ts", ".js"],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: "ts-loader",
        },
      ],
    },
  };