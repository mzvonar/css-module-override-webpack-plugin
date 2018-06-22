# css-module-override-webpack-plugin

This plugin extends `mini-css-extract-plugin` to work with `module-override-loader` and `module-override-webpack-plugin`.

It loads CSS module overrides according to a file pattern and creates additional stylesheet files.

## Install
```bash
npm install css-module-override-webpack-plugin module-override-loader --save-dev
```

## Usage

### Example
Let's say you imported file `base.css` and you have `base.batman.css` and `base.superman.css` in same location.

```js
const CssModuleOverrideWebpackPlugin = require('css-module-override-webpack-plugin');

module.exports = {
    entry: {
        main: 'src/app.js'
    },
    output: {
        path: 'dist/'
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    {
                        loader: 'module-override-loader',
                        options: {
                            overrides: ['batman', 'superman'],
                            pattern: '[name].[override].[ext]'
                        }
                  },
                  "css-loader"
                ]
            }
        ]
    },
    plugins: [
        new CssModuleOverrideWebpackPlugin({
            filename: "[name].css",
            overrides: ['batman', 'superman'],
            standalone: true,
            standaloneOverridesOutputPath: 'overrides/[name].[override].css'
        })
    ]
}
```

Then you will end up with three stylesheet files `dist/main.css`, `dist/main.batman.css` and `main.superman.css`.

#### Usage with module-override-webpack-plugin
If you are using `module-override-webpack-plugin` for JS overrides you have to turn standalone mode off. 
Then CSS overrides will be saved relative to JS override output.

```js
const ModuleOverrideWebpackPlugin = require('module-override-webpack-plugin');
const CssModuleOverrideWebpackPlugin = require('css-module-override-webpack-plugin');

module.exports = {
    entry: {
        main: 'src/app.js'
    },
    output: {
        path: 'dist/',
        filename: '[name]/script.js',
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                use: [
                    {
                        loader: 'module-override-loader',
                        options: {
                            overrides: ['batman', 'superman'],
                            pattern: '[name].[override].[ext]'
                        }
                    },
                    'babel-loader'
                ]
            },
            {
                test: /\.css$/,
                use: [
                    {
                        loader: 'module-override-loader',
                        options: {
                            overrides: ['batman', 'superman'],
                            pattern: '[name].[override].[ext]'
                        }
                    },
                    "css-loader"
                ]
            }
        ]
    },
    plugins: [
        new ModuleOverrideWebpackPlugin({
            overrides: ['batman', 'superman'],
            outputPath: '[name]/overrides/[override]'
        }),
        new CssModuleOverrideWebpackPlugin({
            filename: "[name].css",
            overrides: ['batman', 'superman'],
            standalone: false
        })
    ]
}
```

Then you end up with this result:
```
dist/
-- main/
  -- script.js
  -- main.css
  -- overrides/
    -- batman/
      -- script.js
      -- main.css
    -- superman/
      -- script.js
      -- main.css
```