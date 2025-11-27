module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Modify the webpack configuration to handle dynamic imports properly
      webpackConfig.output = {
        ...webpackConfig.output,
        environment: {
          ...(webpackConfig.output.environment || {}),
          dynamicImport: true,
          module: true,
        },
      };

      // Update target to support modern features
      webpackConfig.target = ["web", "es2017"];

      return webpackConfig;
    },
  },
  babel: {
    plugins: ["@babel/plugin-syntax-dynamic-import"],
  },
};
