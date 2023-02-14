
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.50.1' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const parseNumber = parseFloat;

    function joinCss(obj, separator = ';') {
      let texts;
      if (Array.isArray(obj)) {
        texts = obj.filter((text) => text);
      } else {
        texts = [];
        for (const prop in obj) {
          if (obj[prop]) {
            texts.push(`${prop}:${obj[prop]}`);
          }
        }
      }
      return texts.join(separator);
    }

    function getStyles(style, size, pull, fw) {
      let float;
      let width;
      const height = '1em';
      let lineHeight;
      let fontSize;
      let textAlign;
      let verticalAlign = '-.125em';
      const overflow = 'visible';

      if (fw) {
        textAlign = 'center';
        width = '1.25em';
      }

      if (pull) {
        float = pull;
      }

      if (size) {
        if (size == 'lg') {
          fontSize = '1.33333em';
          lineHeight = '.75em';
          verticalAlign = '-.225em';
        } else if (size == 'xs') {
          fontSize = '.75em';
        } else if (size == 'sm') {
          fontSize = '.875em';
        } else {
          fontSize = size.replace('x', 'em');
        }
      }

      return joinCss([
        joinCss({
          float,
          width,
          height,
          'line-height': lineHeight,
          'font-size': fontSize,
          'text-align': textAlign,
          'vertical-align': verticalAlign,
          'transform-origin': 'center',
          overflow,
        }),
        style,
      ]);
    }

    function getTransform(
      scale,
      translateX,
      translateY,
      rotate,
      flip,
      translateTimes = 1,
      translateUnit = '',
      rotateUnit = '',
    ) {
      let flipX = 1;
      let flipY = 1;

      if (flip) {
        if (flip == 'horizontal') {
          flipX = -1;
        } else if (flip == 'vertical') {
          flipY = -1;
        } else {
          flipX = flipY = -1;
        }
      }

      return joinCss(
        [
          `translate(${parseNumber(translateX) * translateTimes}${translateUnit},${parseNumber(translateY) * translateTimes}${translateUnit})`,
          `scale(${flipX * parseNumber(scale)},${flipY * parseNumber(scale)})`,
          rotate && `rotate(${rotate}${rotateUnit})`,
        ],
        ' ',
      );
    }

    /* ../../node_modules/svelte-fa/src/fa.svelte generated by Svelte v3.50.1 */
    const file$1 = "../../node_modules/svelte-fa/src/fa.svelte";

    // (66:0) {#if i[4]}
    function create_if_block$1(ctx) {
    	let svg;
    	let g1;
    	let g0;
    	let g1_transform_value;
    	let g1_transform_origin_value;
    	let svg_id_value;
    	let svg_class_value;
    	let svg_viewBox_value;

    	function select_block_type(ctx, dirty) {
    		if (typeof /*i*/ ctx[10][4] == 'string') return create_if_block_1$1;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			g1 = svg_element("g");
    			g0 = svg_element("g");
    			if_block.c();
    			attr_dev(g0, "transform", /*transform*/ ctx[12]);
    			add_location(g0, file$1, 81, 6, 1397);
    			attr_dev(g1, "transform", g1_transform_value = "translate(" + /*i*/ ctx[10][0] / 2 + " " + /*i*/ ctx[10][1] / 2 + ")");
    			attr_dev(g1, "transform-origin", g1_transform_origin_value = "" + (/*i*/ ctx[10][0] / 4 + " 0"));
    			add_location(g1, file$1, 77, 4, 1293);
    			attr_dev(svg, "id", svg_id_value = /*id*/ ctx[1] || undefined);
    			attr_dev(svg, "class", svg_class_value = "svelte-fa " + /*clazz*/ ctx[0] + " svelte-1cj2gr0");
    			attr_dev(svg, "style", /*s*/ ctx[11]);
    			attr_dev(svg, "viewBox", svg_viewBox_value = "0 0 " + /*i*/ ctx[10][0] + " " + /*i*/ ctx[10][1]);
    			attr_dev(svg, "aria-hidden", "true");
    			attr_dev(svg, "role", "img");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			toggle_class(svg, "pulse", /*pulse*/ ctx[4]);
    			toggle_class(svg, "spin", /*spin*/ ctx[3]);
    			add_location(svg, file$1, 66, 2, 1071);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, g1);
    			append_dev(g1, g0);
    			if_block.m(g0, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(g0, null);
    				}
    			}

    			if (dirty & /*transform*/ 4096) {
    				attr_dev(g0, "transform", /*transform*/ ctx[12]);
    			}

    			if (dirty & /*i*/ 1024 && g1_transform_value !== (g1_transform_value = "translate(" + /*i*/ ctx[10][0] / 2 + " " + /*i*/ ctx[10][1] / 2 + ")")) {
    				attr_dev(g1, "transform", g1_transform_value);
    			}

    			if (dirty & /*i*/ 1024 && g1_transform_origin_value !== (g1_transform_origin_value = "" + (/*i*/ ctx[10][0] / 4 + " 0"))) {
    				attr_dev(g1, "transform-origin", g1_transform_origin_value);
    			}

    			if (dirty & /*id*/ 2 && svg_id_value !== (svg_id_value = /*id*/ ctx[1] || undefined)) {
    				attr_dev(svg, "id", svg_id_value);
    			}

    			if (dirty & /*clazz*/ 1 && svg_class_value !== (svg_class_value = "svelte-fa " + /*clazz*/ ctx[0] + " svelte-1cj2gr0")) {
    				attr_dev(svg, "class", svg_class_value);
    			}

    			if (dirty & /*s*/ 2048) {
    				attr_dev(svg, "style", /*s*/ ctx[11]);
    			}

    			if (dirty & /*i*/ 1024 && svg_viewBox_value !== (svg_viewBox_value = "0 0 " + /*i*/ ctx[10][0] + " " + /*i*/ ctx[10][1])) {
    				attr_dev(svg, "viewBox", svg_viewBox_value);
    			}

    			if (dirty & /*clazz, pulse*/ 17) {
    				toggle_class(svg, "pulse", /*pulse*/ ctx[4]);
    			}

    			if (dirty & /*clazz, spin*/ 9) {
    				toggle_class(svg, "spin", /*spin*/ ctx[3]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(66:0) {#if i[4]}",
    		ctx
    	});

    	return block;
    }

    // (89:8) {:else}
    function create_else_block$1(ctx) {
    	let path0;
    	let path0_d_value;
    	let path0_fill_value;
    	let path0_fill_opacity_value;
    	let path0_transform_value;
    	let path1;
    	let path1_d_value;
    	let path1_fill_value;
    	let path1_fill_opacity_value;
    	let path1_transform_value;

    	const block = {
    		c: function create() {
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			attr_dev(path0, "d", path0_d_value = /*i*/ ctx[10][4][0]);
    			attr_dev(path0, "fill", path0_fill_value = /*secondaryColor*/ ctx[6] || /*color*/ ctx[2] || 'currentColor');

    			attr_dev(path0, "fill-opacity", path0_fill_opacity_value = /*swapOpacity*/ ctx[9] != false
    			? /*primaryOpacity*/ ctx[7]
    			: /*secondaryOpacity*/ ctx[8]);

    			attr_dev(path0, "transform", path0_transform_value = "translate(" + /*i*/ ctx[10][0] / -2 + " " + /*i*/ ctx[10][1] / -2 + ")");
    			add_location(path0, file$1, 90, 10, 1678);
    			attr_dev(path1, "d", path1_d_value = /*i*/ ctx[10][4][1]);
    			attr_dev(path1, "fill", path1_fill_value = /*primaryColor*/ ctx[5] || /*color*/ ctx[2] || 'currentColor');

    			attr_dev(path1, "fill-opacity", path1_fill_opacity_value = /*swapOpacity*/ ctx[9] != false
    			? /*secondaryOpacity*/ ctx[8]
    			: /*primaryOpacity*/ ctx[7]);

    			attr_dev(path1, "transform", path1_transform_value = "translate(" + /*i*/ ctx[10][0] / -2 + " " + /*i*/ ctx[10][1] / -2 + ")");
    			add_location(path1, file$1, 96, 10, 1935);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path0, anchor);
    			insert_dev(target, path1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*i*/ 1024 && path0_d_value !== (path0_d_value = /*i*/ ctx[10][4][0])) {
    				attr_dev(path0, "d", path0_d_value);
    			}

    			if (dirty & /*secondaryColor, color*/ 68 && path0_fill_value !== (path0_fill_value = /*secondaryColor*/ ctx[6] || /*color*/ ctx[2] || 'currentColor')) {
    				attr_dev(path0, "fill", path0_fill_value);
    			}

    			if (dirty & /*swapOpacity, primaryOpacity, secondaryOpacity*/ 896 && path0_fill_opacity_value !== (path0_fill_opacity_value = /*swapOpacity*/ ctx[9] != false
    			? /*primaryOpacity*/ ctx[7]
    			: /*secondaryOpacity*/ ctx[8])) {
    				attr_dev(path0, "fill-opacity", path0_fill_opacity_value);
    			}

    			if (dirty & /*i*/ 1024 && path0_transform_value !== (path0_transform_value = "translate(" + /*i*/ ctx[10][0] / -2 + " " + /*i*/ ctx[10][1] / -2 + ")")) {
    				attr_dev(path0, "transform", path0_transform_value);
    			}

    			if (dirty & /*i*/ 1024 && path1_d_value !== (path1_d_value = /*i*/ ctx[10][4][1])) {
    				attr_dev(path1, "d", path1_d_value);
    			}

    			if (dirty & /*primaryColor, color*/ 36 && path1_fill_value !== (path1_fill_value = /*primaryColor*/ ctx[5] || /*color*/ ctx[2] || 'currentColor')) {
    				attr_dev(path1, "fill", path1_fill_value);
    			}

    			if (dirty & /*swapOpacity, secondaryOpacity, primaryOpacity*/ 896 && path1_fill_opacity_value !== (path1_fill_opacity_value = /*swapOpacity*/ ctx[9] != false
    			? /*secondaryOpacity*/ ctx[8]
    			: /*primaryOpacity*/ ctx[7])) {
    				attr_dev(path1, "fill-opacity", path1_fill_opacity_value);
    			}

    			if (dirty & /*i*/ 1024 && path1_transform_value !== (path1_transform_value = "translate(" + /*i*/ ctx[10][0] / -2 + " " + /*i*/ ctx[10][1] / -2 + ")")) {
    				attr_dev(path1, "transform", path1_transform_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path0);
    			if (detaching) detach_dev(path1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(89:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (83:8) {#if typeof i[4] == 'string'}
    function create_if_block_1$1(ctx) {
    	let path;
    	let path_d_value;
    	let path_fill_value;
    	let path_transform_value;

    	const block = {
    		c: function create() {
    			path = svg_element("path");
    			attr_dev(path, "d", path_d_value = /*i*/ ctx[10][4]);
    			attr_dev(path, "fill", path_fill_value = /*color*/ ctx[2] || /*primaryColor*/ ctx[5] || 'currentColor');
    			attr_dev(path, "transform", path_transform_value = "translate(" + /*i*/ ctx[10][0] / -2 + " " + /*i*/ ctx[10][1] / -2 + ")");
    			add_location(path, file$1, 83, 10, 1461);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*i*/ 1024 && path_d_value !== (path_d_value = /*i*/ ctx[10][4])) {
    				attr_dev(path, "d", path_d_value);
    			}

    			if (dirty & /*color, primaryColor*/ 36 && path_fill_value !== (path_fill_value = /*color*/ ctx[2] || /*primaryColor*/ ctx[5] || 'currentColor')) {
    				attr_dev(path, "fill", path_fill_value);
    			}

    			if (dirty & /*i*/ 1024 && path_transform_value !== (path_transform_value = "translate(" + /*i*/ ctx[10][0] / -2 + " " + /*i*/ ctx[10][1] / -2 + ")")) {
    				attr_dev(path, "transform", path_transform_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(83:8) {#if typeof i[4] == 'string'}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let if_block_anchor;
    	let if_block = /*i*/ ctx[10][4] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*i*/ ctx[10][4]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Fa', slots, []);
    	let { class: clazz = '' } = $$props;
    	let { id = '' } = $$props;
    	let { style = '' } = $$props;
    	let { icon } = $$props;
    	let { size = '' } = $$props;
    	let { color = '' } = $$props;
    	let { fw = false } = $$props;
    	let { pull = '' } = $$props;
    	let { scale = 1 } = $$props;
    	let { translateX = 0 } = $$props;
    	let { translateY = 0 } = $$props;
    	let { rotate = '' } = $$props;
    	let { flip = false } = $$props;
    	let { spin = false } = $$props;
    	let { pulse = false } = $$props;
    	let { primaryColor = '' } = $$props;
    	let { secondaryColor = '' } = $$props;
    	let { primaryOpacity = 1 } = $$props;
    	let { secondaryOpacity = 0.4 } = $$props;
    	let { swapOpacity = false } = $$props;
    	let i;
    	let s;
    	let transform;

    	const writable_props = [
    		'class',
    		'id',
    		'style',
    		'icon',
    		'size',
    		'color',
    		'fw',
    		'pull',
    		'scale',
    		'translateX',
    		'translateY',
    		'rotate',
    		'flip',
    		'spin',
    		'pulse',
    		'primaryColor',
    		'secondaryColor',
    		'primaryOpacity',
    		'secondaryOpacity',
    		'swapOpacity'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Fa> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('class' in $$props) $$invalidate(0, clazz = $$props.class);
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    		if ('style' in $$props) $$invalidate(13, style = $$props.style);
    		if ('icon' in $$props) $$invalidate(14, icon = $$props.icon);
    		if ('size' in $$props) $$invalidate(15, size = $$props.size);
    		if ('color' in $$props) $$invalidate(2, color = $$props.color);
    		if ('fw' in $$props) $$invalidate(16, fw = $$props.fw);
    		if ('pull' in $$props) $$invalidate(17, pull = $$props.pull);
    		if ('scale' in $$props) $$invalidate(18, scale = $$props.scale);
    		if ('translateX' in $$props) $$invalidate(19, translateX = $$props.translateX);
    		if ('translateY' in $$props) $$invalidate(20, translateY = $$props.translateY);
    		if ('rotate' in $$props) $$invalidate(21, rotate = $$props.rotate);
    		if ('flip' in $$props) $$invalidate(22, flip = $$props.flip);
    		if ('spin' in $$props) $$invalidate(3, spin = $$props.spin);
    		if ('pulse' in $$props) $$invalidate(4, pulse = $$props.pulse);
    		if ('primaryColor' in $$props) $$invalidate(5, primaryColor = $$props.primaryColor);
    		if ('secondaryColor' in $$props) $$invalidate(6, secondaryColor = $$props.secondaryColor);
    		if ('primaryOpacity' in $$props) $$invalidate(7, primaryOpacity = $$props.primaryOpacity);
    		if ('secondaryOpacity' in $$props) $$invalidate(8, secondaryOpacity = $$props.secondaryOpacity);
    		if ('swapOpacity' in $$props) $$invalidate(9, swapOpacity = $$props.swapOpacity);
    	};

    	$$self.$capture_state = () => ({
    		getStyles,
    		getTransform,
    		clazz,
    		id,
    		style,
    		icon,
    		size,
    		color,
    		fw,
    		pull,
    		scale,
    		translateX,
    		translateY,
    		rotate,
    		flip,
    		spin,
    		pulse,
    		primaryColor,
    		secondaryColor,
    		primaryOpacity,
    		secondaryOpacity,
    		swapOpacity,
    		i,
    		s,
    		transform
    	});

    	$$self.$inject_state = $$props => {
    		if ('clazz' in $$props) $$invalidate(0, clazz = $$props.clazz);
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    		if ('style' in $$props) $$invalidate(13, style = $$props.style);
    		if ('icon' in $$props) $$invalidate(14, icon = $$props.icon);
    		if ('size' in $$props) $$invalidate(15, size = $$props.size);
    		if ('color' in $$props) $$invalidate(2, color = $$props.color);
    		if ('fw' in $$props) $$invalidate(16, fw = $$props.fw);
    		if ('pull' in $$props) $$invalidate(17, pull = $$props.pull);
    		if ('scale' in $$props) $$invalidate(18, scale = $$props.scale);
    		if ('translateX' in $$props) $$invalidate(19, translateX = $$props.translateX);
    		if ('translateY' in $$props) $$invalidate(20, translateY = $$props.translateY);
    		if ('rotate' in $$props) $$invalidate(21, rotate = $$props.rotate);
    		if ('flip' in $$props) $$invalidate(22, flip = $$props.flip);
    		if ('spin' in $$props) $$invalidate(3, spin = $$props.spin);
    		if ('pulse' in $$props) $$invalidate(4, pulse = $$props.pulse);
    		if ('primaryColor' in $$props) $$invalidate(5, primaryColor = $$props.primaryColor);
    		if ('secondaryColor' in $$props) $$invalidate(6, secondaryColor = $$props.secondaryColor);
    		if ('primaryOpacity' in $$props) $$invalidate(7, primaryOpacity = $$props.primaryOpacity);
    		if ('secondaryOpacity' in $$props) $$invalidate(8, secondaryOpacity = $$props.secondaryOpacity);
    		if ('swapOpacity' in $$props) $$invalidate(9, swapOpacity = $$props.swapOpacity);
    		if ('i' in $$props) $$invalidate(10, i = $$props.i);
    		if ('s' in $$props) $$invalidate(11, s = $$props.s);
    		if ('transform' in $$props) $$invalidate(12, transform = $$props.transform);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*icon*/ 16384) {
    			$$invalidate(10, i = icon && icon.icon || [0, 0, '', [], '']);
    		}

    		if ($$self.$$.dirty & /*style, size, pull, fw*/ 237568) {
    			$$invalidate(11, s = getStyles(style, size, pull, fw));
    		}

    		if ($$self.$$.dirty & /*scale, translateX, translateY, rotate, flip*/ 8126464) {
    			$$invalidate(12, transform = getTransform(scale, translateX, translateY, rotate, flip, 512));
    		}
    	};

    	return [
    		clazz,
    		id,
    		color,
    		spin,
    		pulse,
    		primaryColor,
    		secondaryColor,
    		primaryOpacity,
    		secondaryOpacity,
    		swapOpacity,
    		i,
    		s,
    		transform,
    		style,
    		icon,
    		size,
    		fw,
    		pull,
    		scale,
    		translateX,
    		translateY,
    		rotate,
    		flip
    	];
    }

    class Fa extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			class: 0,
    			id: 1,
    			style: 13,
    			icon: 14,
    			size: 15,
    			color: 2,
    			fw: 16,
    			pull: 17,
    			scale: 18,
    			translateX: 19,
    			translateY: 20,
    			rotate: 21,
    			flip: 22,
    			spin: 3,
    			pulse: 4,
    			primaryColor: 5,
    			secondaryColor: 6,
    			primaryOpacity: 7,
    			secondaryOpacity: 8,
    			swapOpacity: 9
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Fa",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*icon*/ ctx[14] === undefined && !('icon' in props)) {
    			console.warn("<Fa> was created without expected prop 'icon'");
    		}
    	}

    	get class() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get style() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set style(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get icon() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set icon(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fw() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fw(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get pull() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set pull(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get scale() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set scale(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get translateX() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set translateX(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get translateY() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set translateY(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get rotate() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rotate(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get flip() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set flip(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get spin() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set spin(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get pulse() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set pulse(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get primaryColor() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set primaryColor(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get secondaryColor() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set secondaryColor(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get primaryOpacity() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set primaryOpacity(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get secondaryOpacity() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set secondaryOpacity(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get swapOpacity() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set swapOpacity(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /*!
     * Font Awesome Free 5.15.4 by @fontawesome - https://fontawesome.com
     * License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License)
     */
    var faCaretDown = {
      prefix: 'fas',
      iconName: 'caret-down',
      icon: [320, 512, [], "f0d7", "M31.3 192h257.3c17.8 0 26.7 21.5 14.1 34.1L174.1 354.8c-7.8 7.8-20.5 7.8-28.3 0L17.2 226.1C4.6 213.5 13.5 192 31.3 192z"]
    };
    var faCaretUp = {
      prefix: 'fas',
      iconName: 'caret-up',
      icon: [320, 512, [], "f0d8", "M288.662 352H31.338c-17.818 0-26.741-21.543-14.142-34.142l128.662-128.662c7.81-7.81 20.474-7.81 28.284 0l128.662 128.662c12.6 12.599 3.676 34.142-14.142 34.142z"]
    };
    var faFile = {
      prefix: 'fas',
      iconName: 'file',
      icon: [384, 512, [], "f15b", "M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm160-14.1v6.1H256V0h6.1c6.4 0 12.5 2.5 17 7l97.9 98c4.5 4.5 7 10.6 7 16.9z"]
    };
    var faFileAlt = {
      prefix: 'fas',
      iconName: 'file-alt',
      icon: [384, 512, [], "f15c", "M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm64 236c0 6.6-5.4 12-12 12H108c-6.6 0-12-5.4-12-12v-8c0-6.6 5.4-12 12-12h168c6.6 0 12 5.4 12 12v8zm0-64c0 6.6-5.4 12-12 12H108c-6.6 0-12-5.4-12-12v-8c0-6.6 5.4-12 12-12h168c6.6 0 12 5.4 12 12v8zm0-72v8c0 6.6-5.4 12-12 12H108c-6.6 0-12-5.4-12-12v-8c0-6.6 5.4-12 12-12h168c6.6 0 12 5.4 12 12zm96-114.1v6.1H256V0h6.1c6.4 0 12.5 2.5 17 7l97.9 98c4.5 4.5 7 10.6 7 16.9z"]
    };
    var faFileAudio = {
      prefix: 'fas',
      iconName: 'file-audio',
      icon: [384, 512, [], "f1c7", "M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm-64 268c0 10.7-12.9 16-20.5 8.5L104 376H76c-6.6 0-12-5.4-12-12v-56c0-6.6 5.4-12 12-12h28l35.5-36.5c7.6-7.6 20.5-2.2 20.5 8.5v136zm33.2-47.6c9.1-9.3 9.1-24.1 0-33.4-22.1-22.8 12.2-56.2 34.4-33.5 27.2 27.9 27.2 72.4 0 100.4-21.8 22.3-56.9-10.4-34.4-33.5zm86-117.1c54.4 55.9 54.4 144.8 0 200.8-21.8 22.4-57-10.3-34.4-33.5 36.2-37.2 36.3-96.5 0-133.8-22.1-22.8 12.3-56.3 34.4-33.5zM384 121.9v6.1H256V0h6.1c6.4 0 12.5 2.5 17 7l97.9 98c4.5 4.5 7 10.6 7 16.9z"]
    };
    var faFileCsv = {
      prefix: 'fas',
      iconName: 'file-csv',
      icon: [384, 512, [], "f6dd", "M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm-96 144c0 4.42-3.58 8-8 8h-8c-8.84 0-16 7.16-16 16v32c0 8.84 7.16 16 16 16h8c4.42 0 8 3.58 8 8v16c0 4.42-3.58 8-8 8h-8c-26.51 0-48-21.49-48-48v-32c0-26.51 21.49-48 48-48h8c4.42 0 8 3.58 8 8v16zm44.27 104H160c-4.42 0-8-3.58-8-8v-16c0-4.42 3.58-8 8-8h12.27c5.95 0 10.41-3.5 10.41-6.62 0-1.3-.75-2.66-2.12-3.84l-21.89-18.77c-8.47-7.22-13.33-17.48-13.33-28.14 0-21.3 19.02-38.62 42.41-38.62H200c4.42 0 8 3.58 8 8v16c0 4.42-3.58 8-8 8h-12.27c-5.95 0-10.41 3.5-10.41 6.62 0 1.3.75 2.66 2.12 3.84l21.89 18.77c8.47 7.22 13.33 17.48 13.33 28.14.01 21.29-19 38.62-42.39 38.62zM256 264v20.8c0 20.27 5.7 40.17 16 56.88 10.3-16.7 16-36.61 16-56.88V264c0-4.42 3.58-8 8-8h16c4.42 0 8 3.58 8 8v20.8c0 35.48-12.88 68.89-36.28 94.09-3.02 3.25-7.27 5.11-11.72 5.11s-8.7-1.86-11.72-5.11c-23.4-25.2-36.28-58.61-36.28-94.09V264c0-4.42 3.58-8 8-8h16c4.42 0 8 3.58 8 8zm121-159L279.1 7c-4.5-4.5-10.6-7-17-7H256v128h128v-6.1c0-6.3-2.5-12.4-7-16.9z"]
    };
    var faFileExcel = {
      prefix: 'fas',
      iconName: 'file-excel',
      icon: [384, 512, [], "f1c3", "M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm60.1 106.5L224 336l60.1 93.5c5.1 8-.6 18.5-10.1 18.5h-34.9c-4.4 0-8.5-2.4-10.6-6.3C208.9 405.5 192 373 192 373c-6.4 14.8-10 20-36.6 68.8-2.1 3.9-6.1 6.3-10.5 6.3H110c-9.5 0-15.2-10.5-10.1-18.5l60.3-93.5-60.3-93.5c-5.2-8 .6-18.5 10.1-18.5h34.8c4.4 0 8.5 2.4 10.6 6.3 26.1 48.8 20 33.6 36.6 68.5 0 0 6.1-11.7 36.6-68.5 2.1-3.9 6.2-6.3 10.6-6.3H274c9.5-.1 15.2 10.4 10.1 18.4zM384 121.9v6.1H256V0h6.1c6.4 0 12.5 2.5 17 7l97.9 98c4.5 4.5 7 10.6 7 16.9z"]
    };
    var faFileImage = {
      prefix: 'fas',
      iconName: 'file-image',
      icon: [384, 512, [], "f1c5", "M384 121.941V128H256V0h6.059a24 24 0 0 1 16.97 7.029l97.941 97.941a24.002 24.002 0 0 1 7.03 16.971zM248 160c-13.2 0-24-10.8-24-24V0H24C10.745 0 0 10.745 0 24v464c0 13.255 10.745 24 24 24h336c13.255 0 24-10.745 24-24V160H248zm-135.455 16c26.51 0 48 21.49 48 48s-21.49 48-48 48-48-21.49-48-48 21.491-48 48-48zm208 240h-256l.485-48.485L104.545 328c4.686-4.686 11.799-4.201 16.485.485L160.545 368 264.06 264.485c4.686-4.686 12.284-4.686 16.971 0L320.545 304v112z"]
    };
    var faFilePdf = {
      prefix: 'fas',
      iconName: 'file-pdf',
      icon: [384, 512, [], "f1c1", "M181.9 256.1c-5-16-4.9-46.9-2-46.9 8.4 0 7.6 36.9 2 46.9zm-1.7 47.2c-7.7 20.2-17.3 43.3-28.4 62.7 18.3-7 39-17.2 62.9-21.9-12.7-9.6-24.9-23.4-34.5-40.8zM86.1 428.1c0 .8 13.2-5.4 34.9-40.2-6.7 6.3-29.1 24.5-34.9 40.2zM248 160h136v328c0 13.3-10.7 24-24 24H24c-13.3 0-24-10.7-24-24V24C0 10.7 10.7 0 24 0h200v136c0 13.2 10.8 24 24 24zm-8 171.8c-20-12.2-33.3-29-42.7-53.8 4.5-18.5 11.6-46.6 6.2-64.2-4.7-29.4-42.4-26.5-47.8-6.8-5 18.3-.4 44.1 8.1 77-11.6 27.6-28.7 64.6-40.8 85.8-.1 0-.1.1-.2.1-27.1 13.9-73.6 44.5-54.5 68 5.6 6.9 16 10 21.5 10 17.9 0 35.7-18 61.1-61.8 25.8-8.5 54.1-19.1 79-23.2 21.7 11.8 47.1 19.5 64 19.5 29.2 0 31.2-32 19.7-43.4-13.9-13.6-54.3-9.7-73.6-7.2zM377 105L279 7c-4.5-4.5-10.6-7-17-7h-6v128h128v-6.1c0-6.3-2.5-12.4-7-16.9zm-74.1 255.3c4.1-2.7-2.5-11.9-42.8-9 37.1 15.8 42.8 9 42.8 9z"]
    };
    var faFileVideo = {
      prefix: 'fas',
      iconName: 'file-video',
      icon: [384, 512, [], "f1c8", "M384 121.941V128H256V0h6.059c6.365 0 12.47 2.529 16.971 7.029l97.941 97.941A24.005 24.005 0 0 1 384 121.941zM224 136V0H24C10.745 0 0 10.745 0 24v464c0 13.255 10.745 24 24 24h336c13.255 0 24-10.745 24-24V160H248c-13.2 0-24-10.8-24-24zm96 144.016v111.963c0 21.445-25.943 31.998-40.971 16.971L224 353.941V392c0 13.255-10.745 24-24 24H88c-13.255 0-24-10.745-24-24V280c0-13.255 10.745-24 24-24h112c13.255 0 24 10.745 24 24v38.059l55.029-55.013c15.011-15.01 40.971-4.491 40.971 16.97z"]
    };
    var faFileWord = {
      prefix: 'fas',
      iconName: 'file-word',
      icon: [384, 512, [], "f1c2", "M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm57.1 120H305c7.7 0 13.4 7.1 11.7 14.7l-38 168c-1.2 5.5-6.1 9.3-11.7 9.3h-38c-5.5 0-10.3-3.8-11.6-9.1-25.8-103.5-20.8-81.2-25.6-110.5h-.5c-1.1 14.3-2.4 17.4-25.6 110.5-1.3 5.3-6.1 9.1-11.6 9.1H117c-5.6 0-10.5-3.9-11.7-9.4l-37.8-168c-1.7-7.5 4-14.6 11.7-14.6h24.5c5.7 0 10.7 4 11.8 9.7 15.6 78 20.1 109.5 21 122.2 1.6-10.2 7.3-32.7 29.4-122.7 1.3-5.4 6.1-9.1 11.7-9.1h29.1c5.6 0 10.4 3.8 11.7 9.2 24 100.4 28.8 124 29.6 129.4-.2-11.2-2.6-17.8 21.6-129.2 1-5.6 5.9-9.5 11.5-9.5zM384 121.9v6.1H256V0h6.1c6.4 0 12.5 2.5 17 7l97.9 98c4.5 4.5 7 10.6 7 16.9z"]
    };
    var faFolder = {
      prefix: 'fas',
      iconName: 'folder',
      icon: [512, 512, [], "f07b", "M464 128H272l-64-64H48C21.49 64 0 85.49 0 112v288c0 26.51 21.49 48 48 48h416c26.51 0 48-21.49 48-48V176c0-26.51-21.49-48-48-48z"]
    };
    var faFolderPlus = {
      prefix: 'fas',
      iconName: 'folder-plus',
      icon: [512, 512, [], "f65e", "M464,128H272L208,64H48A48,48,0,0,0,0,112V400a48,48,0,0,0,48,48H464a48,48,0,0,0,48-48V176A48,48,0,0,0,464,128ZM359.5,296a16,16,0,0,1-16,16h-64v64a16,16,0,0,1-16,16h-16a16,16,0,0,1-16-16V312h-64a16,16,0,0,1-16-16V280a16,16,0,0,1,16-16h64V200a16,16,0,0,1,16-16h16a16,16,0,0,1,16,16v64h64a16,16,0,0,1,16,16Z"]
    };
    var faHome = {
      prefix: 'fas',
      iconName: 'home',
      icon: [576, 512, [], "f015", "M280.37 148.26L96 300.11V464a16 16 0 0 0 16 16l112.06-.29a16 16 0 0 0 15.92-16V368a16 16 0 0 1 16-16h64a16 16 0 0 1 16 16v95.64a16 16 0 0 0 16 16.05L464 480a16 16 0 0 0 16-16V300L295.67 148.26a12.19 12.19 0 0 0-15.3 0zM571.6 251.47L488 182.56V44.05a12 12 0 0 0-12-12h-56a12 12 0 0 0-12 12v72.61L318.47 43a48 48 0 0 0-61 0L4.34 251.47a12 12 0 0 0-1.6 16.9l25.5 31A12 12 0 0 0 45.15 301l235.22-193.74a12.19 12.19 0 0 1 15.3 0L530.9 301a12 12 0 0 0 16.9-1.6l25.5-31a12 12 0 0 0-1.7-16.93z"]
    };
    var faTrashAlt = {
      prefix: 'fas',
      iconName: 'trash-alt',
      icon: [448, 512, [], "f2ed", "M32 464a48 48 0 0 0 48 48h288a48 48 0 0 0 48-48V128H32zm272-256a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zM432 32H312l-9.4-18.7A24 24 0 0 0 281.1 0H166.8a23.72 23.72 0 0 0-21.4 13.3L136 32H16A16 16 0 0 0 0 48v32a16 16 0 0 0 16 16h416a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16z"]
    };

    /* src/App.svelte generated by Svelte v3.50.1 */

    const { Object: Object_1, console: console_1 } = globals;

    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[29] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[32] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[35] = list[i];
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[38] = list[i];
    	return child_ctx;
    }

    // (236:16) {:else}
    function create_else_block_2(ctx) {
    	let t_value = /*segment*/ ctx[38].name + "";
    	let t;

    	const block = {
    		c: function create() {
    			t = text(t_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*pathSegments*/ 32 && t_value !== (t_value = /*segment*/ ctx[38].name + "")) set_data_dev(t, t_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2.name,
    		type: "else",
    		source: "(236:16) {:else}",
    		ctx
    	});

    	return block;
    }

    // (234:16) {#if segment.icon}
    function create_if_block_8(ctx) {
    	let fa;
    	let current;

    	fa = new Fa({
    			props: { icon: /*segment*/ ctx[38].icon },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(fa.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(fa, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const fa_changes = {};
    			if (dirty[0] & /*pathSegments*/ 32) fa_changes.icon = /*segment*/ ctx[38].icon;
    			fa.$set(fa_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fa.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fa.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(fa, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_8.name,
    		type: "if",
    		source: "(234:16) {#if segment.icon}",
    		ctx
    	});

    	return block;
    }

    // (229:12) {#each pathSegments as segment}
    function create_each_block_3(ctx) {
    	let li;
    	let current_block_type_index;
    	let if_block;
    	let t;
    	let current;
    	let mounted;
    	let dispose;
    	const if_block_creators = [create_if_block_8, create_else_block_2];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*segment*/ ctx[38].icon) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			li = element("li");
    			if_block.c();
    			t = space();
    			attr_dev(li, "class", "breadcrumb-item");
    			add_location(li, file, 229, 14, 6706);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			if_blocks[current_block_type_index].m(li, null);
    			append_dev(li, t);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(
    					li,
    					"click",
    					function () {
    						if (is_function(/*gotoFolder*/ ctx[16](/*segment*/ ctx[38].location))) /*gotoFolder*/ ctx[16](/*segment*/ ctx[38].location).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(li, t);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			if_blocks[current_block_type_index].d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(229:12) {#each pathSegments as segment}",
    		ctx
    	});

    	return block;
    }

    // (290:18) {:else}
    function create_else_block_1(ctx) {
    	let t_value = /*file*/ ctx[35].filename + "";
    	let t;

    	const block = {
    		c: function create() {
    			t = text(t_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*files*/ 2 && t_value !== (t_value = /*file*/ ctx[35].filename + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(290:18) {:else}",
    		ctx
    	});

    	return block;
    }

    // (288:18) {#if file.isDirectory}
    function create_if_block_7(ctx) {
    	let t0_value = /*file*/ ctx[35].filename + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			t0 = text(t0_value);
    			t1 = text("/");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*files*/ 2 && t0_value !== (t0_value = /*file*/ ctx[35].filename + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(288:18) {#if file.isDirectory}",
    		ctx
    	});

    	return block;
    }

    // (275:12) {#each files as file}
    function create_each_block_2(ctx) {
    	let tr;
    	let td0;
    	let fa;
    	let t0;
    	let td1;
    	let t1;
    	let td2;
    	let t2_value = /*file*/ ctx[35].mimetype + "";
    	let t2;
    	let t3;
    	let td3;

    	let t4_value = (/*file*/ ctx[35].isDirectory
    	? ""
    	: /*file*/ ctx[35].size_kb) + "";

    	let t4;
    	let t5;
    	let td4;
    	let t6_value = /*roles*/ ctx[3][/*file*/ ctx[35].min_role_read] + "";
    	let t6;
    	let t7;
    	let td5;
    	let t8_value = new Date(/*file*/ ctx[35].uploaded_at).toLocaleString() + "";
    	let t8;
    	let current;
    	let mounted;
    	let dispose;

    	fa = new Fa({
    			props: {
    				size: "lg",
    				icon: /*getIcon*/ ctx[17](/*file*/ ctx[35])
    			},
    			$$inline: true
    		});

    	function select_block_type_1(ctx, dirty) {
    		if (/*file*/ ctx[35].isDirectory) return create_if_block_7;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	function click_handler_5(...args) {
    		return /*click_handler_5*/ ctx[25](/*file*/ ctx[35], ...args);
    	}

    	function dblclick_handler() {
    		return /*dblclick_handler*/ ctx[26](/*file*/ ctx[35]);
    	}

    	const block = {
    		c: function create() {
    			tr = element("tr");
    			td0 = element("td");
    			create_component(fa.$$.fragment);
    			t0 = space();
    			td1 = element("td");
    			if_block.c();
    			t1 = space();
    			td2 = element("td");
    			t2 = text(t2_value);
    			t3 = space();
    			td3 = element("td");
    			t4 = text(t4_value);
    			t5 = space();
    			td4 = element("td");
    			t6 = text(t6_value);
    			t7 = space();
    			td5 = element("td");
    			t8 = text(t8_value);
    			add_location(td0, file, 283, 16, 8625);
    			add_location(td1, file, 286, 16, 8724);
    			add_location(td2, file, 293, 16, 8931);
    			set_style(td3, "text-align", "right");
    			add_location(td3, file, 296, 16, 9008);
    			add_location(td4, file, 299, 16, 9134);
    			add_location(td5, file, 302, 16, 9223);
    			attr_dev(tr, "class", "svelte-16rl54v");
    			toggle_class(tr, "selected", /*selectedFiles*/ ctx[4][/*file*/ ctx[35].filename]);
    			add_location(tr, file, 275, 14, 8283);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);
    			append_dev(tr, td0);
    			mount_component(fa, td0, null);
    			append_dev(tr, t0);
    			append_dev(tr, td1);
    			if_block.m(td1, null);
    			append_dev(tr, t1);
    			append_dev(tr, td2);
    			append_dev(td2, t2);
    			append_dev(tr, t3);
    			append_dev(tr, td3);
    			append_dev(td3, t4);
    			append_dev(tr, t5);
    			append_dev(tr, td4);
    			append_dev(td4, t6);
    			append_dev(tr, t7);
    			append_dev(tr, td5);
    			append_dev(td5, t8);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(tr, "click", click_handler_5, false, false, false),
    					listen_dev(tr, "dblclick", dblclick_handler, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const fa_changes = {};
    			if (dirty[0] & /*files*/ 2) fa_changes.icon = /*getIcon*/ ctx[17](/*file*/ ctx[35]);
    			fa.$set(fa_changes);

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(td1, null);
    				}
    			}

    			if ((!current || dirty[0] & /*files*/ 2) && t2_value !== (t2_value = /*file*/ ctx[35].mimetype + "")) set_data_dev(t2, t2_value);

    			if ((!current || dirty[0] & /*files*/ 2) && t4_value !== (t4_value = (/*file*/ ctx[35].isDirectory
    			? ""
    			: /*file*/ ctx[35].size_kb) + "")) set_data_dev(t4, t4_value);

    			if ((!current || dirty[0] & /*roles, files*/ 10) && t6_value !== (t6_value = /*roles*/ ctx[3][/*file*/ ctx[35].min_role_read] + "")) set_data_dev(t6, t6_value);
    			if ((!current || dirty[0] & /*files*/ 2) && t8_value !== (t8_value = new Date(/*file*/ ctx[35].uploaded_at).toLocaleString() + "")) set_data_dev(t8, t8_value);

    			if (!current || dirty[0] & /*selectedFiles, files*/ 18) {
    				toggle_class(tr, "selected", /*selectedFiles*/ ctx[4][/*file*/ ctx[35].filename]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fa.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fa.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    			destroy_component(fa);
    			if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(275:12) {#each files as file}",
    		ctx
    	});

    	return block;
    }

    // (323:6) {#if selectedList.length > 0}
    function create_if_block(ctx) {
    	let h5;
    	let t0_value = /*lastSelected*/ ctx[8].filename + "";
    	let t0;
    	let t1;
    	let t2;
    	let table;
    	let tbody;
    	let t3;
    	let tr0;
    	let th0;
    	let t5;
    	let td0;
    	let t6;
    	let tr1;
    	let th1;
    	let t8;
    	let td1;
    	let t9_value = new Date(/*lastSelected*/ ctx[8].uploaded_at).toLocaleString() + "";
    	let t9;
    	let t10;
    	let tr2;
    	let th2;
    	let t12;
    	let td2;
    	let t13_value = /*roles*/ ctx[3][/*lastSelected*/ ctx[8].min_role_read] + "";
    	let t13;
    	let t14;
    	let div0;
    	let a0;
    	let t15;
    	let a0_href_value;
    	let t16;
    	let a1;
    	let t17;
    	let a1_href_value;
    	let t18;
    	let t19;
    	let div1;
    	let select0;
    	let option0;
    	let t21;
    	let select1;
    	let option1;
    	let t23;
    	let select2;
    	let option2;
    	let option3;
    	let t26;
    	let if_block5_anchor;
    	let mounted;
    	let dispose;
    	let if_block0 = /*lastSelected*/ ctx[8].mime_super === "image" && create_if_block_6(ctx);
    	let if_block1 = !/*lastSelected*/ ctx[8].isDirectory && create_if_block_5(ctx);

    	function select_block_type_2(ctx, dirty) {
    		if (/*lastSelected*/ ctx[8].isDirectory) return create_if_block_4;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type_2(ctx);
    	let if_block2 = current_block_type(ctx);
    	let if_block3 = /*selectedList*/ ctx[6].length > 1 && create_if_block_3(ctx);
    	let each_value_1 = /*rolesList*/ ctx[7];
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = /*directories*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	let if_block4 = /*selectedList*/ ctx[6].length === 1 && create_if_block_2(ctx);
    	let if_block5 = /*selectedList*/ ctx[6].length > 1 && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			h5 = element("h5");
    			t0 = text(t0_value);
    			t1 = space();
    			if (if_block0) if_block0.c();
    			t2 = space();
    			table = element("table");
    			tbody = element("tbody");
    			if (if_block1) if_block1.c();
    			t3 = space();
    			tr0 = element("tr");
    			th0 = element("th");
    			th0.textContent = "MIME type";
    			t5 = space();
    			td0 = element("td");
    			if_block2.c();
    			t6 = space();
    			tr1 = element("tr");
    			th1 = element("th");
    			th1.textContent = "Created";
    			t8 = space();
    			td1 = element("td");
    			t9 = text(t9_value);
    			t10 = space();
    			tr2 = element("tr");
    			th2 = element("th");
    			th2.textContent = "Role to access";
    			t12 = space();
    			td2 = element("td");
    			t13 = text(t13_value);
    			t14 = space();
    			div0 = element("div");
    			a0 = element("a");
    			t15 = text("Link");
    			t16 = text("\n           | \n          ");
    			a1 = element("a");
    			t17 = text("Download");
    			t18 = space();
    			if (if_block3) if_block3.c();
    			t19 = space();
    			div1 = element("div");
    			select0 = element("select");
    			option0 = element("option");
    			option0.textContent = "Set access";

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t21 = space();
    			select1 = element("select");
    			option1 = element("option");
    			option1.textContent = "Move to...";

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t23 = space();
    			select2 = element("select");
    			option2 = element("option");
    			option2.textContent = "Action...";
    			option3 = element("option");
    			option3.textContent = "Delete";
    			if (if_block4) if_block4.c();
    			t26 = space();
    			if (if_block5) if_block5.c();
    			if_block5_anchor = empty();
    			add_location(h5, file, 323, 8, 9774);
    			add_location(th0, file, 342, 14, 10284);
    			add_location(td0, file, 343, 14, 10317);
    			add_location(tr0, file, 341, 12, 10265);
    			add_location(th1, file, 352, 14, 10580);
    			add_location(td1, file, 353, 14, 10611);
    			add_location(tr1, file, 351, 12, 10561);
    			attr_dev(th2, "class", "pe-1");
    			add_location(th2, file, 356, 14, 10723);
    			add_location(td2, file, 357, 14, 10774);
    			add_location(tr2, file, 355, 12, 10704);
    			add_location(tbody, file, 333, 10, 10062);
    			add_location(table, file, 332, 8, 10044);
    			attr_dev(a0, "href", a0_href_value = `/files/serve/${/*lastSelected*/ ctx[8].location}`);
    			add_location(a0, file, 362, 10, 10897);
    			attr_dev(a1, "href", a1_href_value = `/files/download/${/*lastSelected*/ ctx[8].location}`);
    			add_location(a1, file, 364, 10, 10990);
    			add_location(div0, file, 361, 8, 10881);
    			option0.__value = "";
    			option0.value = option0.__value;
    			option0.disabled = true;
    			option0.selected = true;
    			add_location(option0, file, 375, 12, 11402);
    			attr_dev(select0, "class", "form-select svelte-16rl54v");
    			add_location(select0, file, 374, 10, 11332);
    			option1.__value = "";
    			option1.value = option1.__value;
    			option1.disabled = true;
    			option1.selected = true;
    			add_location(option1, file, 382, 12, 11672);
    			attr_dev(select1, "class", "form-select svelte-16rl54v");
    			add_location(select1, file, 381, 10, 11605);
    			option2.__value = "";
    			option2.value = option2.__value;
    			option2.disabled = true;
    			option2.selected = true;
    			add_location(option2, file, 388, 12, 11931);
    			option3.__value = "Delete";
    			option3.value = option3.__value;
    			add_location(option3, file, 389, 12, 11997);
    			attr_dev(select2, "class", "form-select svelte-16rl54v");
    			add_location(select2, file, 387, 10, 11869);
    			attr_dev(div1, "class", "file-actions d-flex svelte-16rl54v");
    			add_location(div1, file, 373, 8, 11288);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h5, anchor);
    			append_dev(h5, t0);
    			insert_dev(target, t1, anchor);
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, table, anchor);
    			append_dev(table, tbody);
    			if (if_block1) if_block1.m(tbody, null);
    			append_dev(tbody, t3);
    			append_dev(tbody, tr0);
    			append_dev(tr0, th0);
    			append_dev(tr0, t5);
    			append_dev(tr0, td0);
    			if_block2.m(td0, null);
    			append_dev(tbody, t6);
    			append_dev(tbody, tr1);
    			append_dev(tr1, th1);
    			append_dev(tr1, t8);
    			append_dev(tr1, td1);
    			append_dev(td1, t9);
    			append_dev(tbody, t10);
    			append_dev(tbody, tr2);
    			append_dev(tr2, th2);
    			append_dev(tr2, t12);
    			append_dev(tr2, td2);
    			append_dev(td2, t13);
    			insert_dev(target, t14, anchor);
    			insert_dev(target, div0, anchor);
    			append_dev(div0, a0);
    			append_dev(a0, t15);
    			append_dev(div0, t16);
    			append_dev(div0, a1);
    			append_dev(a1, t17);
    			insert_dev(target, t18, anchor);
    			if (if_block3) if_block3.m(target, anchor);
    			insert_dev(target, t19, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, select0);
    			append_dev(select0, option0);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(select0, null);
    			}

    			append_dev(div1, t21);
    			append_dev(div1, select1);
    			append_dev(select1, option1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select1, null);
    			}

    			append_dev(div1, t23);
    			append_dev(div1, select2);
    			append_dev(select2, option2);
    			append_dev(select2, option3);
    			if (if_block4) if_block4.m(select2, null);
    			insert_dev(target, t26, anchor);
    			if (if_block5) if_block5.m(target, anchor);
    			insert_dev(target, if_block5_anchor, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(select0, "change", /*changeAccessRole*/ ctx[13], false, false, false),
    					listen_dev(select1, "change", /*moveDirectory*/ ctx[15], false, false, false),
    					listen_dev(select2, "change", /*goAction*/ ctx[12], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*lastSelected*/ 256 && t0_value !== (t0_value = /*lastSelected*/ ctx[8].filename + "")) set_data_dev(t0, t0_value);

    			if (/*lastSelected*/ ctx[8].mime_super === "image") {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_6(ctx);
    					if_block0.c();
    					if_block0.m(t2.parentNode, t2);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (!/*lastSelected*/ ctx[8].isDirectory) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_5(ctx);
    					if_block1.c();
    					if_block1.m(tbody, t3);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (current_block_type === (current_block_type = select_block_type_2(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if_block2.d(1);
    				if_block2 = current_block_type(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(td0, null);
    				}
    			}

    			if (dirty[0] & /*lastSelected*/ 256 && t9_value !== (t9_value = new Date(/*lastSelected*/ ctx[8].uploaded_at).toLocaleString() + "")) set_data_dev(t9, t9_value);
    			if (dirty[0] & /*roles, lastSelected*/ 264 && t13_value !== (t13_value = /*roles*/ ctx[3][/*lastSelected*/ ctx[8].min_role_read] + "")) set_data_dev(t13, t13_value);

    			if (dirty[0] & /*lastSelected*/ 256 && a0_href_value !== (a0_href_value = `/files/serve/${/*lastSelected*/ ctx[8].location}`)) {
    				attr_dev(a0, "href", a0_href_value);
    			}

    			if (dirty[0] & /*lastSelected*/ 256 && a1_href_value !== (a1_href_value = `/files/download/${/*lastSelected*/ ctx[8].location}`)) {
    				attr_dev(a1, "href", a1_href_value);
    			}

    			if (/*selectedList*/ ctx[6].length > 1) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block_3(ctx);
    					if_block3.c();
    					if_block3.m(t19.parentNode, t19);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (dirty[0] & /*rolesList*/ 128) {
    				each_value_1 = /*rolesList*/ ctx[7];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(select0, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (dirty[0] & /*directories*/ 4) {
    				each_value = /*directories*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (/*selectedList*/ ctx[6].length === 1) {
    				if (if_block4) ; else {
    					if_block4 = create_if_block_2(ctx);
    					if_block4.c();
    					if_block4.m(select2, null);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}

    			if (/*selectedList*/ ctx[6].length > 1) {
    				if (if_block5) {
    					if_block5.p(ctx, dirty);
    				} else {
    					if_block5 = create_if_block_1(ctx);
    					if_block5.c();
    					if_block5.m(if_block5_anchor.parentNode, if_block5_anchor);
    				}
    			} else if (if_block5) {
    				if_block5.d(1);
    				if_block5 = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h5);
    			if (detaching) detach_dev(t1);
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(table);
    			if (if_block1) if_block1.d();
    			if_block2.d();
    			if (detaching) detach_dev(t14);
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t18);
    			if (if_block3) if_block3.d(detaching);
    			if (detaching) detach_dev(t19);
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			if (if_block4) if_block4.d();
    			if (detaching) detach_dev(t26);
    			if (if_block5) if_block5.d(detaching);
    			if (detaching) detach_dev(if_block5_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(323:6) {#if selectedList.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (326:8) {#if lastSelected.mime_super === "image"}
    function create_if_block_6(ctx) {
    	let img;
    	let img_src_value;
    	let img_alt_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "file-preview my-2 svelte-16rl54v");
    			if (!src_url_equal(img.src, img_src_value = `/files/serve/${/*lastSelected*/ ctx[8].location}`)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*lastSelected*/ ctx[8].filename);
    			add_location(img, file, 326, 10, 9868);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*lastSelected*/ 256 && !src_url_equal(img.src, img_src_value = `/files/serve/${/*lastSelected*/ ctx[8].location}`)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty[0] & /*lastSelected*/ 256 && img_alt_value !== (img_alt_value = /*lastSelected*/ ctx[8].filename)) {
    				attr_dev(img, "alt", img_alt_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(326:8) {#if lastSelected.mime_super === \\\"image\\\"}",
    		ctx
    	});

    	return block;
    }

    // (335:12) {#if !lastSelected.isDirectory}
    function create_if_block_5(ctx) {
    	let tr;
    	let th;
    	let t1;
    	let td;
    	let t2_value = /*lastSelected*/ ctx[8].size_kb + "";
    	let t2;
    	let t3;

    	const block = {
    		c: function create() {
    			tr = element("tr");
    			th = element("th");
    			th.textContent = "Size";
    			t1 = space();
    			td = element("td");
    			t2 = text(t2_value);
    			t3 = text(" KB");
    			add_location(th, file, 336, 16, 10149);
    			add_location(td, file, 337, 16, 10179);
    			add_location(tr, file, 335, 14, 10128);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);
    			append_dev(tr, th);
    			append_dev(tr, t1);
    			append_dev(tr, td);
    			append_dev(td, t2);
    			append_dev(td, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*lastSelected*/ 256 && t2_value !== (t2_value = /*lastSelected*/ ctx[8].size_kb + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(335:12) {#if !lastSelected.isDirectory}",
    		ctx
    	});

    	return block;
    }

    // (347:16) {:else}
    function create_else_block(ctx) {
    	let t0_value = /*lastSelected*/ ctx[8].mime_super + "";
    	let t0;
    	let t1;
    	let t2_value = /*lastSelected*/ ctx[8].mime_sub + "";
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text(t0_value);
    			t1 = text("/");
    			t2 = text(t2_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*lastSelected*/ 256 && t0_value !== (t0_value = /*lastSelected*/ ctx[8].mime_super + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*lastSelected*/ 256 && t2_value !== (t2_value = /*lastSelected*/ ctx[8].mime_sub + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(347:16) {:else}",
    		ctx
    	});

    	return block;
    }

    // (345:16) {#if lastSelected.isDirectory}
    function create_if_block_4(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Directory");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(345:16) {#if lastSelected.isDirectory}",
    		ctx
    	});

    	return block;
    }

    // (367:8) {#if selectedList.length > 1}
    function create_if_block_3(ctx) {
    	let strong;
    	let t0;
    	let t1_value = /*selectedList*/ ctx[6].length - 1 + "";
    	let t1;
    	let t2;
    	let t3_value = (/*selectedList*/ ctx[6].length > 2 ? "s" : "") + "";
    	let t3;
    	let t4;

    	const block = {
    		c: function create() {
    			strong = element("strong");
    			t0 = text("and ");
    			t1 = text(t1_value);
    			t2 = text(" other file");
    			t3 = text(t3_value);
    			t4 = text(":");
    			add_location(strong, file, 367, 10, 11119);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, strong, anchor);
    			append_dev(strong, t0);
    			append_dev(strong, t1);
    			append_dev(strong, t2);
    			append_dev(strong, t3);
    			append_dev(strong, t4);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*selectedList*/ 64 && t1_value !== (t1_value = /*selectedList*/ ctx[6].length - 1 + "")) set_data_dev(t1, t1_value);
    			if (dirty[0] & /*selectedList*/ 64 && t3_value !== (t3_value = (/*selectedList*/ ctx[6].length > 2 ? "s" : "") + "")) set_data_dev(t3, t3_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(strong);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(367:8) {#if selectedList.length > 1}",
    		ctx
    	});

    	return block;
    }

    // (377:12) {#each rolesList as role}
    function create_each_block_1(ctx) {
    	let option;
    	let t_value = /*role*/ ctx[32].role + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*role*/ ctx[32].id;
    			option.value = option.__value;
    			add_location(option, file, 377, 14, 11509);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*rolesList*/ 128 && t_value !== (t_value = /*role*/ ctx[32].role + "")) set_data_dev(t, t_value);

    			if (dirty[0] & /*rolesList*/ 128 && option_value_value !== (option_value_value = /*role*/ ctx[32].id)) {
    				prop_dev(option, "__value", option_value_value);
    				option.value = option.__value;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(377:12) {#each rolesList as role}",
    		ctx
    	});

    	return block;
    }

    // (384:12) {#each directories as dir}
    function create_each_block(ctx) {
    	let option;
    	let t_value = (/*dir*/ ctx[29].location || "/") + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*dir*/ ctx[29].location || "/";
    			option.value = option.__value;
    			add_location(option, file, 384, 14, 11780);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*directories*/ 4 && t_value !== (t_value = (/*dir*/ ctx[29].location || "/") + "")) set_data_dev(t, t_value);

    			if (dirty[0] & /*directories*/ 4 && option_value_value !== (option_value_value = /*dir*/ ctx[29].location || "/")) {
    				prop_dev(option, "__value", option_value_value);
    				option.value = option.__value;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(384:12) {#each directories as dir}",
    		ctx
    	});

    	return block;
    }

    // (391:12) {#if selectedList.length === 1}
    function create_if_block_2(ctx) {
    	let option;

    	const block = {
    		c: function create() {
    			option = element("option");
    			option.textContent = "Rename";
    			option.__value = "Rename";
    			option.value = option.__value;
    			add_location(option, file, 391, 14, 12079);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(391:12) {#if selectedList.length === 1}",
    		ctx
    	});

    	return block;
    }

    // (396:8) {#if selectedList.length > 1}
    function create_if_block_1(ctx) {
    	let button;
    	let i;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			i = element("i");
    			t = text("\n            Download Zip Archive");
    			attr_dev(i, "class", "fas fa-file-archive");
    			add_location(i, file, 398, 12, 12313);
    			attr_dev(button, "class", "btn btn-outline-secondary mt-2");
    			add_location(button, file, 396, 10, 12211);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, i);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*downloadZip*/ ctx[14], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(396:8) {#if selectedList.length > 1}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let div4;
    	let div2;
    	let div0;
    	let nav;
    	let ol;
    	let t0;
    	let div1;
    	let table;
    	let thead;
    	let tr0;
    	let th0;
    	let t1;
    	let th1;
    	let t2;
    	let fa0;
    	let t3;
    	let th2;
    	let t4;
    	let fa1;
    	let t5;
    	let th3;
    	let fa2;
    	let t6;
    	let t7;
    	let th4;
    	let t8;
    	let fa3;
    	let t9;
    	let th5;
    	let t10;
    	let fa4;
    	let t11;
    	let tbody;
    	let t12;
    	let tr1;
    	let td0;
    	let fa5;
    	let t13;
    	let td1;
    	let t15;
    	let td2;
    	let t16;
    	let td3;
    	let t17;
    	let td4;
    	let t18;
    	let div3;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value_3 = /*pathSegments*/ ctx[5];
    	validate_each_argument(each_value_3);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks_1[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	const out = i => transition_out(each_blocks_1[i], 1, 1, () => {
    		each_blocks_1[i] = null;
    	});

    	fa0 = new Fa({
    			props: {
    				icon: /*getSorterIcon*/ ctx[19]("filename", /*sortBy*/ ctx[9], /*sortDesc*/ ctx[10])
    			},
    			$$inline: true
    		});

    	fa1 = new Fa({
    			props: {
    				icon: /*getSorterIcon*/ ctx[19]("mimetype", /*sortBy*/ ctx[9], /*sortDesc*/ ctx[10])
    			},
    			$$inline: true
    		});

    	fa2 = new Fa({
    			props: {
    				icon: /*getSorterIcon*/ ctx[19]("size_kb", /*sortBy*/ ctx[9], /*sortDesc*/ ctx[10])
    			},
    			$$inline: true
    		});

    	fa3 = new Fa({
    			props: {
    				icon: /*getSorterIcon*/ ctx[19]("min_role_read", /*sortBy*/ ctx[9], /*sortDesc*/ ctx[10])
    			},
    			$$inline: true
    		});

    	fa4 = new Fa({
    			props: {
    				icon: /*getSorterIcon*/ ctx[19]("uploaded_at", /*sortBy*/ ctx[9], /*sortDesc*/ ctx[10])
    			},
    			$$inline: true
    		});

    	let each_value_2 = /*files*/ ctx[1];
    	validate_each_argument(each_value_2);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	const out_1 = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	fa5 = new Fa({
    			props: { size: "lg", icon: faFolderPlus },
    			$$inline: true
    		});

    	let if_block = /*selectedList*/ ctx[6].length > 0 && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div4 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			nav = element("nav");
    			ol = element("ol");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t0 = space();
    			div1 = element("div");
    			table = element("table");
    			thead = element("thead");
    			tr0 = element("tr");
    			th0 = element("th");
    			t1 = space();
    			th1 = element("th");
    			t2 = text("Filename\n                ");
    			create_component(fa0.$$.fragment);
    			t3 = space();
    			th2 = element("th");
    			t4 = text("Media type\n                ");
    			create_component(fa1.$$.fragment);
    			t5 = space();
    			th3 = element("th");
    			create_component(fa2.$$.fragment);
    			t6 = text("\n                Size (KiB)");
    			t7 = space();
    			th4 = element("th");
    			t8 = text("Role to access\n                ");
    			create_component(fa3.$$.fragment);
    			t9 = space();
    			th5 = element("th");
    			t10 = text("Created\n                ");
    			create_component(fa4.$$.fragment);
    			t11 = space();
    			tbody = element("tbody");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t12 = space();
    			tr1 = element("tr");
    			td0 = element("td");
    			create_component(fa5.$$.fragment);
    			t13 = space();
    			td1 = element("td");
    			td1.textContent = "Create new folder...";
    			t15 = space();
    			td2 = element("td");
    			t16 = space();
    			td3 = element("td");
    			t17 = space();
    			td4 = element("td");
    			t18 = space();
    			div3 = element("div");
    			if (if_block) if_block.c();
    			attr_dev(ol, "class", "breadcrumb");
    			add_location(ol, file, 227, 10, 6624);
    			attr_dev(nav, "aria-label", "breadcrumb");
    			add_location(nav, file, 226, 8, 6584);
    			add_location(div0, file, 225, 6, 6570);
    			add_location(th0, file, 247, 14, 7182);
    			add_location(th1, file, 248, 14, 7203);
    			add_location(th2, file, 252, 14, 7382);
    			set_style(th3, "text-align", "right");
    			add_location(th3, file, 256, 14, 7563);
    			add_location(th4, file, 263, 14, 7815);
    			add_location(th5, file, 267, 14, 8010);
    			add_location(tr0, file, 246, 12, 7163);
    			add_location(thead, file, 245, 10, 7143);
    			add_location(td0, file, 308, 14, 9442);
    			add_location(td1, file, 311, 14, 9534);
    			add_location(td2, file, 312, 14, 9578);
    			add_location(td3, file, 313, 14, 9599);
    			add_location(td4, file, 314, 14, 9620);
    			add_location(tr1, file, 307, 12, 9366);
    			add_location(tbody, file, 273, 10, 8227);
    			attr_dev(table, "class", "table table-sm");
    			add_location(table, file, 244, 8, 7102);
    			attr_dev(div1, "class", "filelist svelte-16rl54v");
    			add_location(div1, file, 243, 6, 7071);
    			attr_dev(div2, "class", "col-8");
    			add_location(div2, file, 224, 4, 6544);
    			attr_dev(div3, "class", "col-4");
    			add_location(div3, file, 321, 4, 9710);
    			attr_dev(div4, "class", "row");
    			add_location(div4, file, 223, 2, 6522);
    			add_location(main, file, 222, 0, 6513);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div4);
    			append_dev(div4, div2);
    			append_dev(div2, div0);
    			append_dev(div0, nav);
    			append_dev(nav, ol);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(ol, null);
    			}

    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			append_dev(div1, table);
    			append_dev(table, thead);
    			append_dev(thead, tr0);
    			append_dev(tr0, th0);
    			append_dev(tr0, t1);
    			append_dev(tr0, th1);
    			append_dev(th1, t2);
    			mount_component(fa0, th1, null);
    			append_dev(tr0, t3);
    			append_dev(tr0, th2);
    			append_dev(th2, t4);
    			mount_component(fa1, th2, null);
    			append_dev(tr0, t5);
    			append_dev(tr0, th3);
    			mount_component(fa2, th3, null);
    			append_dev(th3, t6);
    			append_dev(tr0, t7);
    			append_dev(tr0, th4);
    			append_dev(th4, t8);
    			mount_component(fa3, th4, null);
    			append_dev(tr0, t9);
    			append_dev(tr0, th5);
    			append_dev(th5, t10);
    			mount_component(fa4, th5, null);
    			append_dev(table, t11);
    			append_dev(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tbody, null);
    			}

    			append_dev(tbody, t12);
    			append_dev(tbody, tr1);
    			append_dev(tr1, td0);
    			mount_component(fa5, td0, null);
    			append_dev(tr1, t13);
    			append_dev(tr1, td1);
    			append_dev(tr1, t15);
    			append_dev(tr1, td2);
    			append_dev(tr1, t16);
    			append_dev(tr1, td3);
    			append_dev(tr1, t17);
    			append_dev(tr1, td4);
    			append_dev(div4, t18);
    			append_dev(div4, div3);
    			if (if_block) if_block.m(div3, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(th1, "click", /*click_handler*/ ctx[20], false, false, false),
    					listen_dev(th2, "click", /*click_handler_1*/ ctx[21], false, false, false),
    					listen_dev(th3, "click", /*click_handler_2*/ ctx[22], false, false, false),
    					listen_dev(th4, "click", /*click_handler_3*/ ctx[23], false, false, false),
    					listen_dev(th5, "click", /*click_handler_4*/ ctx[24], false, false, false),
    					listen_dev(tr1, "click", /*click_handler_6*/ ctx[27], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*gotoFolder, pathSegments*/ 65568) {
    				each_value_3 = /*pathSegments*/ ctx[5];
    				validate_each_argument(each_value_3);
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    						transition_in(each_blocks_1[i], 1);
    					} else {
    						each_blocks_1[i] = create_each_block_3(child_ctx);
    						each_blocks_1[i].c();
    						transition_in(each_blocks_1[i], 1);
    						each_blocks_1[i].m(ol, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_3.length; i < each_blocks_1.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			const fa0_changes = {};
    			if (dirty[0] & /*sortBy, sortDesc*/ 1536) fa0_changes.icon = /*getSorterIcon*/ ctx[19]("filename", /*sortBy*/ ctx[9], /*sortDesc*/ ctx[10]);
    			fa0.$set(fa0_changes);
    			const fa1_changes = {};
    			if (dirty[0] & /*sortBy, sortDesc*/ 1536) fa1_changes.icon = /*getSorterIcon*/ ctx[19]("mimetype", /*sortBy*/ ctx[9], /*sortDesc*/ ctx[10]);
    			fa1.$set(fa1_changes);
    			const fa2_changes = {};
    			if (dirty[0] & /*sortBy, sortDesc*/ 1536) fa2_changes.icon = /*getSorterIcon*/ ctx[19]("size_kb", /*sortBy*/ ctx[9], /*sortDesc*/ ctx[10]);
    			fa2.$set(fa2_changes);
    			const fa3_changes = {};
    			if (dirty[0] & /*sortBy, sortDesc*/ 1536) fa3_changes.icon = /*getSorterIcon*/ ctx[19]("min_role_read", /*sortBy*/ ctx[9], /*sortDesc*/ ctx[10]);
    			fa3.$set(fa3_changes);
    			const fa4_changes = {};
    			if (dirty[0] & /*sortBy, sortDesc*/ 1536) fa4_changes.icon = /*getSorterIcon*/ ctx[19]("uploaded_at", /*sortBy*/ ctx[9], /*sortDesc*/ ctx[10]);
    			fa4.$set(fa4_changes);

    			if (dirty[0] & /*selectedFiles, files, rowClick, gotoFolder, roles, getIcon*/ 198682) {
    				each_value_2 = /*files*/ ctx[1];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(tbody, t12);
    					}
    				}

    				group_outros();

    				for (i = each_value_2.length; i < each_blocks.length; i += 1) {
    					out_1(i);
    				}

    				check_outros();
    			}

    			if (/*selectedList*/ ctx[6].length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(div3, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_3.length; i += 1) {
    				transition_in(each_blocks_1[i]);
    			}

    			transition_in(fa0.$$.fragment, local);
    			transition_in(fa1.$$.fragment, local);
    			transition_in(fa2.$$.fragment, local);
    			transition_in(fa3.$$.fragment, local);
    			transition_in(fa4.$$.fragment, local);

    			for (let i = 0; i < each_value_2.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			transition_in(fa5.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks_1 = each_blocks_1.filter(Boolean);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				transition_out(each_blocks_1[i]);
    			}

    			transition_out(fa0.$$.fragment, local);
    			transition_out(fa1.$$.fragment, local);
    			transition_out(fa2.$$.fragment, local);
    			transition_out(fa3.$$.fragment, local);
    			transition_out(fa4.$$.fragment, local);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			transition_out(fa5.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks_1, detaching);
    			destroy_component(fa0);
    			destroy_component(fa1);
    			destroy_component(fa2);
    			destroy_component(fa3);
    			destroy_component(fa4);
    			destroy_each(each_blocks, detaching);
    			destroy_component(fa5);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    async function POST(url, body, isDownload) {
    	const go = fetch(url, {
    		headers: {
    			"X-Requested-With": "XMLHttpRequest",
    			"CSRF-Token": window._sc_globalCsrf,
    			"Content-Type": "application/json"
    		},
    		method: "POST",
    		body: JSON.stringify(body || {})
    	});

    	if (isDownload) {
    		const res = await go;
    		const blob = await res.blob();
    		const link = document.createElement("a");
    		link.href = window.URL.createObjectURL(blob);
    		const header = res.headers.get('Content-Disposition');

    		if (header) {
    			const parts = header.split(';');
    			let filename = parts[1].split('=')[1].replaceAll('"', "");
    			link.download = filename;
    		} else link.target = "_blank";

    		link.click();
    		return;
    	} else return await go;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let { files = [] } = $$props;
    	let { directories = [] } = $$props;
    	let { roles = {} } = $$props;
    	let { currentFolder = "/" } = $$props;
    	let selectedList = [];
    	let selectedFiles = {};
    	let rolesList;
    	let lastSelected;

    	const fetchAndReset = async function (keepSelection) {
    		const response = await fetch(`/files?dir=${currentFolder}`, {
    			headers: { "X-Requested-With": "XMLHttpRequest" }
    		});

    		const data = await response.json();
    		$$invalidate(1, files = data.files);

    		for (const file of files) {
    			file.mimetype = file.mime_sub && file.mime_super
    			? `${file.mime_super}/${file.mime_sub}`
    			: "";
    		}

    		$$invalidate(2, directories = data.directories);
    		$$invalidate(7, rolesList = data.roles);

    		for (const role of data.roles) {
    			$$invalidate(3, roles[role.id] = role.role, roles);
    		}

    		if (!keepSelection) {
    			$$invalidate(6, selectedList = []);
    			$$invalidate(4, selectedFiles = {});
    			$$invalidate(8, lastSelected = null);
    		} else if (lastSelected) {
    			$$invalidate(8, lastSelected = files.find(f => f.filename === lastSelected.filename));
    		}

    		clickHeader("filename");
    	};

    	onMount(fetchAndReset);

    	function rowClick(file, e) {
    		file.selected = true;
    		const prev = selectedFiles[file.filename];
    		if (!e.shiftKey) $$invalidate(4, selectedFiles = {});
    		$$invalidate(4, selectedFiles[file.filename] = !prev, selectedFiles);

    		if (!prev) $$invalidate(8, lastSelected = file); else {
    			const firstSelected = Object.entries(selectedFiles).findLast(([k, v]) => v);
    			if (firstSelected) $$invalidate(8, lastSelected = files.find(f => f.filename === firstSelected[0])); else $$invalidate(8, lastSelected = null);
    		}

    		document.getSelection().removeAllRanges();
    		console.log(lastSelected);
    	}

    	async function goAction(e) {
    		const action = e?.target.value;
    		if (!action) return;

    		switch (action) {
    			case "Delete":
    				if (!confirm(`Delete files: ${selectedList.join()}`)) return;
    				for (const fileNm of selectedList) {
    					const file = files.find(f => f.filename === fileNm);
    					const delres = await POST(`/files/delete/${file.location}`);
    					const deljson = await delres.json();

    					if (deljson.error) {
    						window.notifyAlert({ type: "danger", text: deljson.error });
    					}
    				}
    				await fetchAndReset();
    				break;
    			case "Rename":
    				const newName = window.prompt(`Rename ${lastSelected.filename} to:`, lastSelected.filename);
    				if (!newName) return;
    				await POST(`/files/setname/${lastSelected.location}`, { value: newName });
    				await fetchAndReset();
    				break;
    		}
    	}

    	async function changeAccessRole(e) {
    		const role = e.target.value;

    		for (const fileNm of selectedList) {
    			const file = files.find(f => f.filename === fileNm);
    			await POST(`/files/setrole/${file.location}`, { role });
    		}

    		await fetchAndReset(true);
    	}

    	async function downloadZip() {
    		const filesToZip = [];

    		for (const fileNm of selectedList) {
    			filesToZip.push(fileNm);
    		}

    		await POST(
    			`/files/download-zip`,
    			{
    				files: filesToZip,
    				location: currentFolder
    			},
    			true
    		);
    	}

    	async function moveDirectory(e) {
    		for (const fileNm of selectedList) {
    			const new_path = e.target.value;
    			if (!new_path) return;
    			const file = files.find(f => f.filename === fileNm);
    			await POST(`/files/move/${file.location}`, { new_path });
    		}

    		await fetchAndReset();
    	}

    	function gotoFolder(folder) {
    		$$invalidate(0, currentFolder = folder);
    		fetchAndReset();
    	}

    	let pathSegments = [];

    	function getIcon(file) {
    		if (file.mime_super === "image") return faFileImage;
    		if (file.mime_super === "audio") return faFileAudio;
    		if (file.mime_super === "video") return faFileVideo;
    		if (file.mime_sub === "pdf") return faFilePdf;
    		if (file.isDirectory) return faFolder;
    		const fname = file.filename.toLowerCase();
    		if (fname.endsWith(".csv")) return faFileCsv;
    		if (fname.endsWith(".xls")) return faFileExcel;
    		if (fname.endsWith(".xlsx")) return faFileExcel;
    		if (fname.endsWith(".doc")) return faFileWord;
    		if (fname.endsWith(".docx")) return faFileWord;
    		if (fname.endsWith(".txt")) return faFileAlt;
    		return faFile;
    	}

    	let sortBy;
    	let sortDesc = false;

    	function clickHeader(varNm) {
    		if (sortBy === varNm) $$invalidate(10, sortDesc = !sortDesc); else $$invalidate(9, sortBy = varNm);
    		let getter = x => x[sortBy];
    		if (sortBy === "uploaded_at") getter = x => new Date(x[sortBy]);
    		if (sortBy === "filename") getter = x => (x[sortBy] || "").toLowerCase();

    		const cmp = (a, b) => {
    			if (getter(a) < getter(b)) return sortDesc ? 1 : -1;
    			if (getter(a) > getter(b)) return sortDesc ? -1 : 1;
    			return 0;
    		};

    		$$invalidate(1, files = files.sort(cmp));
    	}

    	function getSorterIcon(varNm) {
    		if (varNm !== sortBy) return null;
    		return sortDesc ? faCaretDown : faCaretUp;
    	}

    	const writable_props = ['files', 'directories', 'roles', 'currentFolder'];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => clickHeader("filename");
    	const click_handler_1 = () => clickHeader("mimetype");
    	const click_handler_2 = () => clickHeader("size_kb");
    	const click_handler_3 = () => clickHeader("min_role_read");
    	const click_handler_4 = () => clickHeader("uploaded_at");
    	const click_handler_5 = (file, e) => rowClick(file, e);

    	const dblclick_handler = file => {
    		if (file.isDirectory) gotoFolder(file.location); else window.open(`/files/serve/${file.location}`);
    	};

    	const click_handler_6 = () => window.create_new_folder(currentFolder);

    	$$self.$$set = $$props => {
    		if ('files' in $$props) $$invalidate(1, files = $$props.files);
    		if ('directories' in $$props) $$invalidate(2, directories = $$props.directories);
    		if ('roles' in $$props) $$invalidate(3, roles = $$props.roles);
    		if ('currentFolder' in $$props) $$invalidate(0, currentFolder = $$props.currentFolder);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		Fa,
    		faTrashAlt,
    		faFileImage,
    		faFile,
    		faFolder,
    		faFileCsv,
    		faFileExcel,
    		faFileWord,
    		faFilePdf,
    		faFileAlt,
    		faFileAudio,
    		faFileVideo,
    		faFolderPlus,
    		faHome,
    		faCaretUp,
    		faCaretDown,
    		files,
    		directories,
    		roles,
    		currentFolder,
    		selectedList,
    		selectedFiles,
    		rolesList,
    		lastSelected,
    		fetchAndReset,
    		rowClick,
    		POST,
    		goAction,
    		changeAccessRole,
    		downloadZip,
    		moveDirectory,
    		gotoFolder,
    		pathSegments,
    		getIcon,
    		sortBy,
    		sortDesc,
    		clickHeader,
    		getSorterIcon
    	});

    	$$self.$inject_state = $$props => {
    		if ('files' in $$props) $$invalidate(1, files = $$props.files);
    		if ('directories' in $$props) $$invalidate(2, directories = $$props.directories);
    		if ('roles' in $$props) $$invalidate(3, roles = $$props.roles);
    		if ('currentFolder' in $$props) $$invalidate(0, currentFolder = $$props.currentFolder);
    		if ('selectedList' in $$props) $$invalidate(6, selectedList = $$props.selectedList);
    		if ('selectedFiles' in $$props) $$invalidate(4, selectedFiles = $$props.selectedFiles);
    		if ('rolesList' in $$props) $$invalidate(7, rolesList = $$props.rolesList);
    		if ('lastSelected' in $$props) $$invalidate(8, lastSelected = $$props.lastSelected);
    		if ('pathSegments' in $$props) $$invalidate(5, pathSegments = $$props.pathSegments);
    		if ('sortBy' in $$props) $$invalidate(9, sortBy = $$props.sortBy);
    		if ('sortDesc' in $$props) $$invalidate(10, sortDesc = $$props.sortDesc);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*selectedFiles*/ 16) {
    			$$invalidate(6, selectedList = Object.entries(selectedFiles).filter(([k, v]) => v).map(([k, v]) => k));
    		}

    		if ($$self.$$.dirty[0] & /*currentFolder, pathSegments*/ 33) {
    			{
    				if (currentFolder === "/" || currentFolder === "") $$invalidate(5, pathSegments = [{ icon: faHome, location: "/" }]); else {
    					$$invalidate(5, pathSegments = currentFolder.split("/").map((name, i) => ({
    						name,
    						location: currentFolder.split("/").slice(0, i + 1).join("/")
    					})));

    					pathSegments.unshift({ icon: faHome, location: "/" });
    				}
    			}
    		}
    	};

    	return [
    		currentFolder,
    		files,
    		directories,
    		roles,
    		selectedFiles,
    		pathSegments,
    		selectedList,
    		rolesList,
    		lastSelected,
    		sortBy,
    		sortDesc,
    		rowClick,
    		goAction,
    		changeAccessRole,
    		downloadZip,
    		moveDirectory,
    		gotoFolder,
    		getIcon,
    		clickHeader,
    		getSorterIcon,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		dblclick_handler,
    		click_handler_6
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance,
    			create_fragment,
    			safe_not_equal,
    			{
    				files: 1,
    				directories: 2,
    				roles: 3,
    				currentFolder: 0
    			},
    			null,
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get files() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set files(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get directories() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set directories(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get roles() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set roles(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get currentFolder() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set currentFolder(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.getElementById("saltcorn-file-manager"),
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
