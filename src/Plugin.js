import validateOptions from 'schema-utils';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import debug from './debug';
import fixBabelClass from './fixBabelClass';

const MODULE_TYPE = 'css/mini-extract';
const MAIN_NS = '__moduleOverrideWebpackPlugin__';
const LOADER_NS = '__moduleOverrides__';
const REGEXP_OVERRIDE = /\[override\]/gi;
const pluginName = 'css-module-override-webpack-plugin';

const schema = {
    type: 'object',
    properties: {
        overrides: {
            type: 'array',
            minItems: 1
        },
        keepOriginals: {
            type: 'boolean'
        },
        standalone: {
            type: 'boolean'
        },
        standaloneOverridesOutputPath: {
            type: 'string'
        }
    },
    required: ['overrides']
};

const getReplacer = (value, allowEmpty) => {
    const fn = (match, ...args) => {
        // last argument in replacer is the entire input string
        const input = args[args.length - 1];
        if (value === null || value === undefined) {
            if (!allowEmpty)
                throw new Error(
                    `Path variable ${match} not implemented in this context: ${input}`
                );
            return "";
        } else {
            return `${value}`;
        }
    };
    return fn;
};

function getModule(compilation, resource) {
    for(let i = 0, length = compilation.modules.length; i < length; i += 1) {
        if(compilation.modules[i].type === MODULE_TYPE && compilation.modules[i].issuer.resource === resource) {
            return compilation.modules[i];
        }
    }
}

class CssModuleOverrideWebpackPlugin extends MiniCssExtractPlugin {
    constructor(options) {
        validateOptions(schema, options, 'css-module-override-webpack-plugin');

        super(options);
    }

    addOverrideIndices(originalModule, replacedModule, chunk) {
        chunk.groupsIterable.forEach((chunkGroup => {
            if (typeof chunkGroup.getModuleIndex2 === 'function') {
                const moduleIndex = chunkGroup.getModuleIndex2(originalModule);
                if(typeof moduleIndex !== 'undefined') {
                    chunkGroup.setModuleIndex2(replacedModule, moduleIndex);
                }
            }
        }));
    }

    getReplacedModules(modules, override, compilation, chunk) {
        const output = [];

        for(let i = 0, length = modules.length; i < length; i += 1) {
            const module = modules[i];

            const overridePath = compilation[LOADER_NS].overridesMap && compilation[LOADER_NS].overridesMap[module.issuer.resource] && compilation[LOADER_NS].overridesMap[module.issuer.resource][override];
            const replacedModule = overridePath && getModule(compilation, overridePath);

            if(replacedModule) {
                debug('Adding replaced module: ', replacedModule.issuer && replacedModule.issuer.id);
                output.push(replacedModule);

                this.addOverrideIndices(module, replacedModule, chunk);
            }
            else if(this.options.keepOriginals) {
                output.push(module);
            }
        }

        return output;
    }

    replaceModules(chunk, override, compilation) {
        chunk.modulesIterable.forEach(module => {
            if(module.type === MODULE_TYPE) {
                const overridePath = compilation[LOADER_NS].overridesMap && compilation[LOADER_NS].overridesMap[module.issuer.resource] && compilation[LOADER_NS].overridesMap[module.issuer.resource][override];

                if(overridePath) {
                    const moduleOverride = getModule(compilation, overridePath);

                    if(moduleOverride || !this.options.keepOriginals) {
                        chunk.modulesIterable.delete(module);
                    }

                    if(moduleOverride) {
                        this.addOverrideIndices(module, moduleOverride, chunk);
                        chunk.modulesIterable.add(moduleOverride);
                    }
                }
            }
        });
    }

    apply(compiler) {
        if(!this.options.standalone) {
            compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {

                compilation.mainTemplate.hooks.renderManifest.tap(
                    pluginName,
                    (result, { chunk }) => {
                        if(compilation[MAIN_NS] && compilation[MAIN_NS].entryMap && compilation[MAIN_NS].entryMap[chunk.name]) {
                            const override = compilation[MAIN_NS].entryMap[chunk.name];

                            chunk.id += override;
                            // this.options.filename = this.getOutputPath(this.options.overridesOutputPath, override);

                            this.replaceModules(chunk, override, compilation);
                        }
                    }
                );
                compilation.chunkTemplate.hooks.renderManifest.tap(
                    pluginName,
                    (result, { chunk }) => {
                        if(compilation[MAIN_NS] && compilation[MAIN_NS].entryMap && compilation[MAIN_NS].entryMap[chunk.name]) {
                            const override = compilation[MAIN_NS].entryMap[chunk.name];

                            chunk.id += override;

                            this.replaceModules(chunk, override, compilation);
                        }
                    }
                );
            });
        }


        super.apply(compiler);

        if(this.options.standalone) {
            compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {

                compilation.mainTemplate.hooks.renderManifest.tap(
                    pluginName,
                    (result, { chunk }) => {
                        const renderedModules = Array.from(chunk.modulesIterable).filter(
                            (module) => module.type === MODULE_TYPE
                        );

                        if(renderedModules.length > 0) {
                            for(let i = 0, length = this.options.overrides.length; i < length; i += 1) {
                                const override = this.options.overrides[i];

                                result.push({
                                    render: () =>
                                        this.renderContentAsset(
                                            compilation,
                                            chunk,
                                            this.getReplacedModules(renderedModules, override, compilation, chunk),
                                            compilation.runtimeTemplate.requestShortener
                                        ),
                                    filenameTemplate: this.getOutputPath(this.options.standaloneOverridesOutputPath, override),
                                    pathOptions: {
                                        chunk,
                                        contentHashType: MODULE_TYPE,
                                    },
                                    identifier: `${pluginName}.${override}.${chunk.id}`,
                                    hash: chunk.contentHash[MODULE_TYPE],
                                });
                            }


                        }
                    }
                );
                compilation.chunkTemplate.hooks.renderManifest.tap(
                    pluginName,
                    (result, { chunk }) => {
                        const renderedModules = Array.from(chunk.modulesIterable).filter(
                            (module) => module.type === MODULE_TYPE
                        );

                        if (renderedModules.length > 0) {
                            for(let i = 0, length = compilation.__webpackModuleOverride__.overrides.length; i < length; i += 1) {
                                const override = compilation.__webpackModuleOverride__.overrides[i];

                                result.push({
                                    render: () =>
                                        this.renderContentAsset(
                                            compilation,
                                            chunk,
                                            this.getReplacedModules(renderedModules),
                                            compilation.runtimeTemplate.requestShortener
                                        ),
                                    filenameTemplate: this.getOutputPath(this.options.standaloneOverridesOutputPath, override),
                                    pathOptions: {
                                        chunk,
                                        contentHashType: MODULE_TYPE,
                                    },
                                    identifier: `${pluginName}.${override}.${chunk.id}`,
                                    hash: chunk.contentHash[MODULE_TYPE],
                                });
                            }


                        }
                    }
                );
            });
        }
    }

    getOutputPath(path, override) {
        return path.replace(REGEXP_OVERRIDE, getReplacer(override));
    }
}

export default fixBabelClass(CssModuleOverrideWebpackPlugin);