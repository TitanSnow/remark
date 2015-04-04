'use strict';

var assert = require('assert');
var he = require('he');
var mdast = require('..');
var fixtures = require('./fixtures.js');
var chalk = require('chalk');
var diff = require('diff');
var badges = require('./badges.js');
var mentions = require('./mentions.js');

/*
 * Settings.
 */

var INDENT = 2;

/**
 * No-operation.
 */
function noop() {}

/**
 * No-operation plugin.
 *
 * @return {Function} - `noop`.
 */
function plugin() {
    return noop;
}

/**
 * Construct an empty node.
 *
 * @return {Object}
 */
function empty() {
    return {
        'type': 'root',
        'children': []
    };
}

/*
 * Tests.
 */

describe('mdast.parse(value, options, CustomParser)', function () {
    it('should be a `function`', function () {
        assert(typeof mdast.parse === 'function');
    });

    it('should throw when `value` is not a string', function () {
        assert.throws(function () {
            mdast.parse(false);
        }, /false/);
    });

    it('should throw when `options` is not an object', function () {
        assert.throws(function () {
            mdast.parse('', false);
        }, /options/);
    });

    it('should throw when `options.gfm` is not a boolean', function () {
        assert.throws(function () {
            mdast.parse('', {
                'gfm': Infinity
            });
        }, /options.gfm/);
    });

    it('should throw when `options.footnotes` is not a boolean', function () {
        assert.throws(function () {
            mdast.parse('', {
                'footnotes': 1
            });
        }, /options.footnotes/);
    });

    it('should throw when `options.breaks` is not a boolean', function () {
        assert.throws(function () {
            mdast.parse('', {
                'breaks': 'unicorn'
            });
        }, /options.breaks/);
    });

    it('should throw when `options.pedantic` is not a boolean', function () {
        assert.throws(function () {
            mdast.parse('', {
                'pedantic': {}
            });
        }, /options.pedantic/);
    });

    it('should throw when `options.yaml` is not a boolean', function () {
        assert.throws(function () {
            mdast.parse('', {
                'yaml': [true]
            });
        }, /options.yaml/);
    });

    it('should throw parse errors', function () {
        var processor = mdast();
        var message = 'Found it!';
        var hasThrown;

        /**
         * Tokenizer.
         */
        function emphasis(eat) {
            throw eat.exception(message);
        }

        processor.Parser.prototype.inlineTokenizers.emphasis = emphasis;

        try {
            processor.parse('Hello *World*!');
        } catch (exception) {
            hasThrown = true;

            assert(exception.filename === '<text>');
            assert(exception.line === 1);
            assert(exception.column === 7);
            assert(exception.reason === message);
            assert(exception.message === '<text>:1:7: ' + message);
        }

        assert(hasThrown === true);
    });

    it('should throw `he` errors', function () {
        var reason = 'Parse error: named character reference was ' +
            'not terminated by a semicolon';
        var hasThrown;

        he.decode.options.strict = true;

        try {
            mdast.parse('Hello&amp.');
        } catch (exception) {
            hasThrown = true;

            assert(exception.filename === '<text>');
            assert(exception.line === 1);
            assert(exception.column === 11);
            assert(exception.reason === reason);
            assert(exception.message === '<text>:1:11: ' + reason);
        }

        assert(hasThrown === true);

        he.decode.options.strict = false;
    });

    it('should not accept inherited properties', function () {
        /**
         * Fixture for inherited options.
         */
        function CustomOptions() {}

        CustomOptions.prototype.gfm = 'Invalid and inherited.';

        assert.doesNotThrow(function () {
            mdast.parse('', new CustomOptions());
        });
    });

    it('should accept a `CustomParser` as a third argument', function () {
        var isInvoked;
        var Parser = mdast.parse.Parser;
        var proto;

        /**
         * Extensible prototype.
         */
        function Proto() {}

        Proto.prototype = Parser.prototype;

        proto = new Proto();

        /**
         * Mock `parse`.
         */
        function parse() {
            isInvoked = true;

            return {};
        }

        /**
         * Construct a parser.
         *
         * @constructor {CustomParser}
         */
        function CustomParser() {
            return Parser.apply(this, arguments);
        }

        CustomParser.prototype = proto;

        CustomParser.prototype.parse = parse;

        mdast.parse('', null, CustomParser);

        assert(isInvoked === true);
    });

    it('should be able to set options', function () {
        var processor = mdast();
        var html = processor.Parser.prototype.blockTokenizers.html;
        var result;

        /**
         * Set option when an HMTL comment occurs:
         * `<!-- $key -->`, turns on `$key`.
         *
         * @param {function(string)} eat
         * @param {string} $0
         */
        function replacement(eat, $0) {
            var token = /<!--\s*(.*?)\s*-->/g.exec($0);
            var options = {};

            if (token) {
                options[token[1]] = true;

                this.setOptions(options);
            }

            return html.apply(this, arguments);
        }

        processor.Parser.prototype.blockTokenizers.html = replacement;

        result = processor.parse([
            '<!-- commonmark -->',
            '',
            '1)   Hello World',
            ''
        ].join('\n'));

        assert(result.children[1].type === 'list');
    });
});

describe('mdast.stringify(ast, options, CustomCompiler)', function () {
    it('should be a `function`', function () {
        assert(typeof mdast.stringify === 'function');
    });

    it('should throw when `ast` is not an object', function () {
        assert.throws(function () {
            mdast.stringify(false);
        }, /false/);
    });

    it('should throw when `ast` is not a valid node', function () {
        assert.throws(function () {
            mdast.stringify({
                'type': 'unicorn'
            });
        }, /unicorn/);
    });

    it('should throw when `options` is not an object', function () {
        assert.throws(function () {
            mdast.stringify(empty(), false);
        }, /options/);
    });

    it('should throw when `options.bullet` is not a valid list bullet',
        function () {
            assert.throws(function () {
                mdast.stringify(empty(), {
                    'bullet': true
                });
            }, /options\.bullet/);
        }
    );

    it('should throw when `options.rule` is not a valid ' +
        'horizontal rule bullet',
        function () {
            assert.throws(function () {
                mdast.stringify(empty(), {
                    'rule': true
                });
            }, /options\.rule/);
        }
    );

    it('should throw when `options.ruleSpaces` is not a boolean',
        function () {
            assert.throws(function () {
                mdast.stringify(empty(), {
                    'ruleSpaces': 1
                });
            }, /options\.ruleSpaces/);
        }
    );

    it('should throw when `options.ruleRepetition` is not a ' +
        'valid repetition count',
        function () {
            assert.throws(function () {
                mdast.stringify(empty(), {
                    'ruleRepetition': 1
                });
            }, /options\.ruleRepetition/);

            assert.throws(function () {
                mdast.stringify(empty(), {
                    'ruleRepetition': NaN
                });
            }, /options\.ruleRepetition/);

            assert.throws(function () {
                mdast.stringify(empty(), {
                    'ruleRepetition': true
                });
            }, /options\.ruleRepetition/);
        }
    );

    it('should throw when `options.emphasis` is not a ' +
        'valid emphasis marker',
        function () {
            assert.throws(function () {
                mdast.stringify(empty(), {
                    'emphasis': '-'
                });
            }, /options\.emphasis/);
        }
    );

    it('should throw when `options.strong` is not a ' +
        'valid emphasis marker',
        function () {
            assert.throws(function () {
                mdast.stringify(empty(), {
                    'strong': '-'
                });
            }, /options\.strong/);
        }
    );

    it('should throw when `options.setext` is not a boolean',
        function () {
            assert.throws(function () {
                mdast.stringify(empty(), {
                    'setext': 0
                });
            }, /options\.setext/);
        }
    );

    it('should throw when `options.referenceLinks` is not a boolean',
        function () {
            assert.throws(function () {
                mdast.stringify(empty(), {
                    'referenceLinks': Infinity
                });
            }, /options\.referenceLinks/);
        }
    );

    it('should throw when `options.fences` is not a boolean',
        function () {
            assert.throws(function () {
                mdast.stringify(empty(), {
                    'fences': NaN
                });
            }, /options\.fences/);
        }
    );

    it('should throw when `options.fence` is not a ' +
        'valid fence marker',
        function () {
            assert.throws(function () {
                mdast.stringify(empty(), {
                    'fence': '-'
                });
            }, /options\.fence/);
        }
    );

    it('should throw when `options.closeAtx` is not a boolean', function () {
        assert.throws(function () {
            mdast.stringify(empty(), {
                'closeAtx': NaN
            });
        }, /options\.closeAtx/);
    });

    it('should throw when `options.looseTable` is not a boolean',
        function () {
            assert.throws(function () {
                mdast.stringify(empty(), {
                    'looseTable': 'Hello!'
                });
            }, /options\.looseTable/);
        }
    );

    it('should throw when `options.spacedTable` is not a boolean',
        function () {
            assert.throws(function () {
                mdast.stringify(empty(), {
                    'spacedTable': 'World'
                });
            }, /options\.spacedTable/);
        }
    );

    it('should not accept inherited properties', function () {
        /**
         * Fixture for inherited options.
         */
        function CustomOptions() {}

        /*
         * An inherited invalid `fence` option.
         */

        CustomOptions.prototype.fence = '-';

        assert.doesNotThrow(function () {
            mdast.stringify(empty(), new CustomOptions());
        });
    });

    it('should accept a `CustomCompiler` as a third argument', function () {
        var Compiler = mdast.stringify.Compiler;
        var isInvoked;

        /**
         * Construct a compiler.
         *
         * @constructor {CustomCompiler}
         */
        function CustomCompiler() {
            return Compiler.apply(this, arguments);
        }

        /**
         * Mock `visit`.
         */
        function visit() {
            isInvoked = true;

            return '';
        }

        CustomCompiler.prototype.visit = visit;
        CustomCompiler.prototype.setOptions = Compiler.prototype.setOptions;
        CustomCompiler.prototype.options = Compiler.prototype.options;
        CustomCompiler.prototype.defaults = Compiler.prototype.defaults;

        mdast.stringify(empty(), null, CustomCompiler);

        assert(isInvoked === true);
    });

    it('should be able to set options', function () {
        var processor = mdast();
        var html = processor.Compiler.prototype.html;
        var ast;

        ast = processor.parse([
            '<!-- setext -->',
            '',
            '# Hello World',
            ''
        ].join('\n'));

        /**
         * Set option when an HMTL comment occurs:
         * `<!-- $key -->`, turns on `$key`.
         *
         * @param {Object} token
         * @return {string}
         */
        function replacement(token) {
            var value = token.value;
            var result = /<!--\s*(.*?)\s*-->/g.exec(value);
            var options = {};

            if (result) {
                options[result[1]] = true;

                this.setOptions(options);
            }

            return html.apply(this, arguments);
        }

        processor.Compiler.prototype.html = replacement;

        assert(processor.stringify(ast) === [
            '<!-- setext -->',
            '',
            'Hello World',
            '===========',
            ''
        ].join('\n'));
    });
});

describe('mdast.use(plugin, options)', function () {
    it('should be a `function`', function () {
        assert(typeof mdast.use === 'function');
    });

    it('should accept an attacher', function () {
        mdast.use(noop);
    });

    it('should accept multiple attachers', function () {
        mdast.use([function () {}, function () {}]);
    });

    it('should return an instance of mdast', function () {
        var processor = mdast.use(noop);

        assert(mdast.use(noop) instanceof processor.constructor);
    });

    it('should attach an attacher', function () {
        var processor = mdast.use(noop);

        assert(processor.attachers.length === 1);
    });

    it('should attach a transformer', function () {
        var processor = mdast.use(plugin);

        assert(processor.ware.fns.length === 1);
    });

    it('should attach multiple attachers', function () {
        var processor = mdast.use(function () {}).use(function () {});

        assert(processor.attachers.length === 2);
    });

    it('should not attach the same attacher multiple times', function () {
        var processor = mdast.use(plugin).use(plugin);

        assert(processor.attachers.length === 1);
    });

    it('should attach multiple transformers', function () {
        var processor;

        /**
         * Transformer.
         */
        processor = mdast.use(function () {
            return function () {};
        }).use(function () {
            return function () {};
        });

        assert(processor.ware.fns.length === 2);
    });

    it('should attach the same transformer multiple times', function () {
        var processor;

        /**
         * Transformer.
         */
        function transformer() {}

        processor = mdast.use(function () {
            return transformer;
        }).use(function () {
            return transformer;
        });

        assert(processor.ware.fns.length === 2);
    });

    it('should invoke an attacher when `use()` is invoked', function () {
        var options = {};
        var isInvoked;

        /**
         * Attacher.
         */
        function assertion(processor, settings) {
            assert('use' in processor);
            assert(settings === options);

            isInvoked = true;
        }

        mdast.use(assertion, options);

        assert(isInvoked === true);
    });

    it('should fail if an exception occurs in an attacher', function () {
        var exception = new Error('test');

        /**
         * Thrower.
         */
        function thrower() {
            throw exception;
        }

        assert.throws(function () {
            mdast.use(thrower);
        }, /test/);
    });
});

describe('mdast.run(ast, options)', function () {
    it('should be a `function`', function () {
        assert(typeof mdast.run === 'function');
    });

    it('should accept an ast', function () {
        mdast.run(empty());
    });

    it('should throw when `ast` is not an AST', function () {
        assert.throws(function () {
            mdast.run(false);
        }, /false/);
    });

    it('should accept options', function () {
        mdast.run(empty(), {});
    });

    it('should return the given ast', function () {
        var node = empty();

        assert(node === mdast.run(node, {}));
    });
});

describe('function attacher(mdast, options)', function () {
    /*
     * Lot's of other tests are in
     * `mdast.use(plugin, options)`.
     */

    it('should be able to modify `Parser` without affecting other instances',
        function () {
            var doc = 'Hello w/ a @mention!\n';

            assert(
                mdast.stringify(mdast.use(mentions).parse(doc)) ===
                'Hello w/ a [@mention](https://github.com/blog/821)!\n'
            );

            assert(mdast.stringify(mdast.parse(doc)) === doc);
        }
    );
});

describe('function transformer(ast, options, mdast)', function () {
    it('should be invoked when `parse()` is invoked', function () {
        var options = {};
        var isInvoked;

        /**
         * Plugin.
         */
        function assertion(ast, settings) {
            assert(ast.type === 'root');
            assert(settings === options);

            isInvoked = true;
        }

        /**
         * Attacher.
         */
        function attacher() {
            return assertion;
        }

        mdast.use(attacher).parse('# Hello world', options);

        assert(isInvoked === true);
    });

    it('should be invoked when `parse()` is invoked', function () {
        var result = mdast.parse('# Hello world');
        var options = {};
        var isInvoked;

        /**
         * Plugin.
         */
        function assertion(ast, settings) {
            assert(ast === result);
            assert(settings === options);

            isInvoked = true;
        }

        /**
         * Attacher.
         */
        function attacher() {
            return assertion;
        }

        mdast.use(attacher).run(result, options);

        assert(isInvoked === true);
    });

    it('should fail mdast if an exception occurs', function () {
        var exception = new Error('test');
        var fixture = '# Hello world';
        var ast = mdast.parse(fixture);
        var processor;

        /**
         * Thrower.
         */
        function thrower() {
            throw exception;
        }

        /**
         * Attacher.
         */
        function attacher() {
            return thrower;
        }

        processor = mdast.use(attacher);

        assert.throws(function () {
            processor.parse(fixture);
        }, /test/);

        assert.throws(function () {
            processor.run(ast);
        }, /test/);
    });

    it('should work on an example plugin', function () {
        var processor = mdast.use(badges);
        var source = processor.stringify(processor.parse('# mdast'));

        assert(
            source ===
            '# mdast [![Version](http://img.shields.io/npm/v/mdast.svg)' +
            '](https://www.npmjs.com/package/mdast)\n'
        );

        source = processor.stringify(processor.parse('# mdast', {
            'flat': true
        }));

        assert(
            source ===
            '# mdast [![Version](http://img.shields.io/npm/v/mdast.svg' +
            '?style=flat)](https://www.npmjs.com/package/mdast)\n'
        );
    });
});

var validateToken;
var validateTokens;

/**
 * Validate `children`.
 *
 * @param {Array.<Object>} children
 */
validateTokens = function (children) {
    children.forEach(validateToken);
};

/**
 * Validate `context`.
 *
 * @param {Object} context
 */
validateToken = function (context) {
    var keys = Object.keys(context).length;
    var type = context.type;

    assert('type' in context);

    if ('children' in context) {
        assert(Array.isArray(context.children));
        validateTokens(context.children);
    }

    /*
     * Validate position.
     */

    if (type !== 'footnoteDefinition' || 'position' in context) {
        assert('position' in context);

        assert('start' in context.position);
        assert('end' in context.position);

        assert('line' in context.position.start);
        assert('column' in context.position.start);

        assert('line' in context.position.end);
        assert('column' in context.position.end);

        keys--;
    }

    if ('value' in context) {
        assert(typeof context.value === 'string');
    }

    if (type === 'root') {
        assert('children' in context);

        if (context.footnotes) {
            Object.keys(context.footnotes).forEach(function (id) {
                validateToken(context.footnotes[id]);
            });
        }

        return;
    }

    if (
        type === 'paragraph' ||
        type === 'blockquote' ||
        type === 'tableHeader' ||
        type === 'tableRow' ||
        type === 'tableCell' ||
        type === 'strong' ||
        type === 'emphasis' ||
        type === 'delete'
    ) {
        assert(keys === 2);
        assert('children' in context);

        return;
    }

    if (type === 'listItem') {
        assert(keys === 3 || keys === 4);
        assert('children' in context);
        assert('loose' in context);

        if (keys === 4) {
            assert(
                context.checked === true ||
                context.checked === false ||
                context.checked === null
            );
        }

        return;
    }

    if (type === 'footnote') {
        assert(keys === 2);
        assert('id' in context);

        return;
    }

    if (type === 'heading') {
        assert(keys === 3);
        assert(context.depth > 0);
        assert(context.depth <= 6);
        assert('children' in context);

        return;
    }

    if (
        type === 'text' ||
        type === 'escape' ||
        type === 'inlineCode' ||
        type === 'yaml'
    ) {
        assert(keys === 2);
        assert('value' in context);

        return;
    }

    if (type === 'code') {
        assert(keys === 3);
        assert('value' in context);

        assert(
            context.lang === null ||
            typeof context.lang === 'string'
        );

        return;
    }

    if (type === 'horizontalRule' || type === 'break') {
        assert(keys === 1);

        return;
    }

    if (type === 'list') {
        assert('children' in context);
        assert(typeof context.ordered === 'boolean');
        assert(keys === 4);

        if (context.ordered) {
            assert(typeof context.start === 'number');
            assert(context.start === context.start);
        } else {
            assert(context.start === null);
        }

        return;
    }

    if (type === 'footnoteDefinition') {
        assert(keys === 3);
        assert('children' in context);
        assert('id' in context);

        return;
    }

    if (type === 'link') {
        assert('children' in context);
        assert(
            context.title === null ||
            typeof context.title === 'string'
        );
        assert(typeof context.href === 'string');
        assert(keys === 4);

        return;
    }

    if (type === 'image') {
        assert(
            context.title === null ||
            typeof context.title === 'string'
        );
        assert(
            context.alt === null ||
            typeof context.alt === 'string'
        );
        assert(typeof context.src === 'string');
        assert(keys === 4);

        return;
    }

    if (type === 'table') {
        assert(keys === 3);
        assert('children' in context);

        assert(Array.isArray(context.align));

        context.align.forEach(function (align) {
            assert(
                align === null ||
                align === 'left' ||
                align === 'right' ||
                align === 'center'
            );
        });

        return;
    }

    /* This is the last possible type. If more types are added, they
     * should be added before this block, or the type:html tests should
     * be wrapped in an if statement. */
    assert(type === 'html');
    assert(keys === 2);
    assert('value' in context);
};

/**
 * Clone, and optionally clean from `position`, a node.
 *
 * @param {Object} node
 * @param {boolean} clean
 * @return {Object}
 */
function clone(node, clean) {
    var result = Array.isArray(node) ? [] : {};

    Object.keys(node).forEach(function (key) {
        var value = node[key];

        if (clean) {
            if (key === 'position') {
                return;
            }
        }

        if (key === 'footnotes' && Object.keys(value).length === 0) {
            return;
        }

        if (key === 'checked' && value === null) {
            return;
        }

        if (key === 'start' && (value === null || value === 1)) {
            return;
        }

        if (value !== null && typeof value === 'object') {
            result[key] = clone(value, clean);
        } else {
            result[key] = value;
        }
    });

    return result;
}

/*
 * Methods.
 */

var stringify = JSON.stringify;

/**
 * Diff node.
 *
 * @param {Object} node
 * @param {Object} baseline
 * @param {boolean} clean
 */
function compare(node, baseline, clean) {
    validateToken(node);

    try {
        assert.deepEqual(clone(node, clean), clone(baseline, clean));
    } catch (error) {
        /* istanbul ignore next */
        logDifference(
            stringify(clone(baseline, clean), null, INDENT),
            stringify(clone(node, clean), null, INDENT)
        );

        /* istanbul ignore next */
        throw error;
    }
}

/**
 * Diff text.
 *
 * @param {string} value
 * @param {string} baseline
 */
function compareText(value, baseline) {
    try {
        assert(value === baseline);
    } catch (error) {
        /* istanbul ignore next */
        logDifference(baseline, value);

        /* istanbul ignore next */
        throw error;
    }
}

/*
 * Fixtures.
 */

describe('fixtures', function () {
    fixtures.forEach(function (fixture) {
        describe(fixture.name, function () {
            var input = fixture.input;
            var possibilities = fixture.possibilities;
            var mapping = fixture.mapping;
            var trees = fixture.trees;
            var output = fixture.output;

            Object.keys(possibilities).forEach(function (key) {
                var name = key || 'default';
                var parse = possibilities[key];
                var node = mdast.parse(input, parse);
                var markdown = mdast.stringify(node, fixture.stringify);

                it('should parse `' + name + '` correctly', function () {
                    compare(node, trees[mapping[key]], false);
                });

                if (output !== false) {
                    it('should stringify `' + name + '`', function () {
                        compare(node, mdast.parse(markdown, parse), true);
                    });
                }

                if (output === true) {
                    it('should stringify `' + name + '` exact', function () {
                        compareText(fixture.input, markdown);
                    });
                }
            });
        });
    });
});

/* istanbul ignore next */

/**
 * Log the difference between `value` and `alternative`.
 *
 * @param {string} value
 * @param {string} alternative
 */
function logDifference(value, alternative) {
    var difference = diff.diffLines(value, alternative);

    if (difference && difference.length) {
        difference.forEach(function (change, index) {
            var colour;
            var changes;
            var start;
            var end;

            colour = change.added ? 'green' : change.removed ? 'red' : 'dim';

            changes = change.value;

            if (colour === 'dim') {
                changes = changes.split('\n');

                if (changes.length > 6) {
                    start = changes.slice(0, 3);
                    end = changes.slice(-3);

                    if (index === 0) {
                        start = [];
                    } else if (index === difference.length - 1) {
                        end = [];
                    }

                    changes = start.concat('...', end);
                }

                changes = changes.join('\n');
            }

            process.stdout.write(chalk[colour](changes));
        });
    }
}
