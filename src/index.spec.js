// import * as transformer from './index';
const transformer = require('./index');
// import { applyTransform } from '@codeshift/test-utils';
const applyTransform = require('@codeshift/test-utils').applyTransform;

it('should remove all deleted props', async () => {
    const result = await applyTransform(
        transformer,
        `
    import { map as _map, filter as _filter } from 'lodash';
    import { filter as fpFilter } from 'lodash/fp';
    import _ from 'lodash'

    _.isObject({});
    `,
        { parser: 'tsx' }
    );

    expect(result).toMatchInlineSnapshot(`
    import _map from 'lodash/map';
    import _filter from 'lodash/filter';
    import { filter as fpFilter } from 'lodash/fp';
    import fpFilter from 'lodash/fp/filter';
    import isObject from 'lodash/isObject';

    isObject({});
  `);
});
