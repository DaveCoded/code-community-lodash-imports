const isLodashImport = node => node.source.value.startsWith('lodash');
const isDefaultImport = specifiers =>
    specifiers.length === 1 && specifiers[0].type === 'ImportDefaultSpecifier';
const isDefaultLodashImport = (specifiers, importedFrom) =>
    isDefaultImport(specifiers) && importedFrom === 'lodash';
const isDefaultLodashFPImport = (specifiers, importedFrom) =>
    isDefaultImport(specifiers) && importedFrom === 'lodash/fp';
const isNamedLodashImport = (specifiers, importedFrom) =>
    specifiers.length && specifiers[0].type === 'ImportSpecifier' && importedFrom === 'lodash';
const isNamedFPLodashImport = (specifiers, importedFrom) =>
    specifiers.length && specifiers[0].type === 'ImportSpecifier' && importedFrom === 'lodash/fp';

const replaceExpression = (path, j) =>
    j.callExpression(j.identifier(path.node.callee.property.name), path.node.arguments);

module.exports = function(file, api) {
    const j = api.jscodeshift;
    const root = j(file.source);

    let defaultImportName = null;
    let defaultFPImportName = null;
    const defaultSpecifiers = new Set();
    const defaultFPSpecifiers = new Set();

    // Get all imports from modules that start with 'lodash'
    const imports = root.find(j.ImportDeclaration, isLodashImport);

    const defaultImportsCollection = imports.filter(path =>
        isDefaultLodashImport(path.node.specifiers, path.value.source.value)
    );
    const defaultFPImportsCollection = imports.filter(path =>
        isDefaultLodashFPImport(path.node.specifiers, path.value.source.value)
    );
    const namedImportsCollection = imports.filter(path =>
        isNamedLodashImport(path.node.specifiers, path.value.source.value)
    );
    const namedFPImportsCollection = imports.filter(path =>
        isNamedFPLodashImport(path.node.specifiers, path.value.source.value)
    );

    // Store name of default import
    defaultImportsCollection.forEach(path => {
        const specifiers = path.value.specifiers.length && path.value.specifiers;
        defaultImportName = specifiers[0].local.name;
    });

    // Store name of default FP import
    defaultFPImportsCollection.forEach(path => {
        const specifiers = path.value.specifiers.length && path.value.specifiers;
        defaultFPImportName = specifiers[0].local.name;
    });

    /**
     * Transform named imports, preserving aliases
     * e.g. import { map as lodashMap } from 'lodash';
     *   => import lodashMap from 'lodash/map';
     */
    namedImportsCollection.replaceWith(path => {
        return path.node.specifiers.map(specifier => {
            const fileName = specifier.imported.name;
            const importName = specifier.local.name;

            return j.importDeclaration(
                [j.importDefaultSpecifier(j.identifier(importName))],
                j.stringLiteral(`lodash/${fileName}`)
            );
        });
    });

    /**
     * Transform named FP imports, preserving aliases
     * e.g. import { map as fpMap } from 'lodash/fp';
     *   => import lodashMap from 'lodash/fp/map';
     */
    namedFPImportsCollection.replaceWith(path => {
        return path.node.specifiers.map(specifier => {
            const fileName = specifier.imported.name;
            const importName = specifier.local.name;

            return j.importDeclaration(
                [j.importDefaultSpecifier(j.identifier(importName))],
                j.stringLiteral(`lodash/fp/${fileName}`)
            );
        });
    });

    /**
     * Collect the methods used on the default lodash import
     * e.g. _.map(...), _.filter(...) etc.
     * and replace them with map(...) and filter(...)
     */
    root.find(j.CallExpression, isLodashExpression)
        .forEach(path => defaultSpecifiers.add(path.node.callee.property.name))
        .replaceWith(path => replaceExpression(path, j));

    root.find(j.CallExpression, isLodashFPExpression)
        .forEach(path => defaultFPSpecifiers.add(path.node.callee.property.name))
        .replaceWith(path => replaceExpression(path, j));

    /**
     * Replace the default lodash import with method imports for each defaultSpecifier
     * e.g. import _ from 'lodash';
     *   => import map from 'lodash/map';
     *      import filter from 'lodash/filter';
     */
    defaultImportsCollection.replaceWith(() =>
        [...defaultSpecifiers].map(specifier => {
            return j.importDeclaration(
                [j.importDefaultSpecifier(j.identifier(specifier))],
                j.stringLiteral(`lodash/${specifier}`)
            );
        })
    );

    // Replace the default FP lodash import with method imports for each defaultFPSpecifier
    defaultFPImportsCollection.replaceWith(() =>
        [...defaultFPSpecifiers].map(specifier => {
            return j.importDeclaration(
                [j.importDefaultSpecifier(j.identifier(specifier))],
                j.stringLiteral(`lodash/fp/${specifier}`)
            );
        })
    );

    function isLodashExpression(node) {
        return (
            node.callee.type === 'MemberExpression' &&
            node.callee.object &&
            node.callee.object.name === defaultImportName
        );
    }

    function isLodashFPExpression(node) {
        return (
            node.callee.type === 'MemberExpression' &&
            node.callee.object &&
            node.callee.object.name === defaultFPImportName
        );
    }

    return root.toSource({
        quote: 'single'
    });
};
