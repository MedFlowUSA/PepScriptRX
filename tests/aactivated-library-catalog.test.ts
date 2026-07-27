import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAactivatedLibraryProductPath,
  getAactivatedLibrarySearch,
} from '../src/lib/aactivatedLibraryCatalog.ts';

test('AACTIVATED library only creates shopping links for catalog-backed compounds', () => {
  assert.equal(getAactivatedLibrarySearch('retatrutide'), 'Retatrutide');
  assert.equal(getAactivatedLibrarySearch('mots-c'), 'MOTS-C');
  assert.equal(getAactivatedLibrarySearch('sermorelin'), null);
  assert.equal(getAactivatedLibrarySearch('b12'), null);
});

test('AACTIVATED library links preserve the catalog search handoff', () => {
  assert.equal(
    getAactivatedLibraryProductPath('cjc-ipamorelin'),
    '/aactivated?search=CJC&from=library#aactivated-top-sellers',
  );
  assert.equal(getAactivatedLibraryProductPath('thymosin-alpha-1'), null);
});
