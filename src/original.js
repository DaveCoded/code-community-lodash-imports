// import { namedTypes } from 'ast-types';
// import core, { API, FileInfo, ASTPath } from 'jscodeshift';

export const parser = 'tsx';

export default (fileInfo, api) => {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);
    const specifiers = [];
    let defaultSpecifier = null;

    root.find(j.ImportDeclaration, isLodashImport)
        .forEach(specifier => {
            if (specifier.type === 'ImportDefaultSpecifier') {
                // We can't assume that a default import would use '_' because that's just convention
                defaultSpecifier = specifier.local.name;
            } else {
                // Collect all named imports
                specifiers.push(specifier.local.name);
            }
        })
        .remove();

    // Find and replace all uses of the default import methods; add them to the specifiers array
    root.find(j.CallExpression, isLodashExpression)
        .forEach(path => specifiers.push(path.node.callee.property.name))
        .replaceWith(path => replaceExpression(path, j));

    if (specifiers.length) {
        // Remove duplicates and the default from specifiers
        cleanSpecifiers(specifiers).forEach(specifier => {
            // Add correct import for each unique specifier at the top of the file
            root.find(j.Declaration)
                .at(0)
                .insertBefore(createImport(j, specifier));
        });
    }

    function isLodashExpression(node) {
        return (
            node.callee.type === 'MemberExpression' &&
            node.callee.object &&
            node.callee.object.name === defaultSpecifier
        );
    }

    function cleanSpecifiers(specifiersToFilter) {
        return specifiersToFilter.filter((specifier, index) => {
            return (
                specifier !== defaultSpecifier && specifiersToFilter.indexOf(specifier) === index
            );
        });
    }

    return root.toSource({
        quote: 'single'
    });
};

function isLodashImport(node) {
    return node.source.value.startsWith('lodash') && !node.source.value.startsWith('lodash/');
}

function replaceExpression(path, j) {
    return j.callExpression(j.identifier(path.node.callee.property.name), path.node.arguments);
}

function createImport(j, specifier) {
    return j.importDeclaration(
        [j.importDefaultSpecifier(j.identifier(specifier))],
        j.stringLiteral(`lodash/${specifier}`)
    );
}
