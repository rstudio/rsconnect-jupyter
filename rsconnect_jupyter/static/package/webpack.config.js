const path = require('path');

module.exports = {
    entry: 'index.js',
    output: {
        path: path.resolve(__dirname, 'lib'),
        filename: 'index.js',
        libraryTarget: 'commonjs2'
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader',
                    'postcss-loader'
                ]
            }
        ]
    },
    resolve: {
      modules: [
        'src',
        'node_modules'
      ],
      extensions: [
        '.js',
        '.jsx',
        '.ts',
        '.tsx'
      ]
    },
    externals: [
      /^@jupyterlab\/.+$/,
      /^@phosphor\/.+$/
    ],
    plugins: [],
    devtool: 'source-map'
};
