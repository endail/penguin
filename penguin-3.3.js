/*
 * 
 *	Penguin, v3.3
 *	Development
 *	28th July, 2014
 *	
 *	TODO: make the buffer act like a stack (a la, PHP outpur buffering)
 *	TODO: find a good way to pass parameters to this code (eg. document.currentScript)
 *		
 *	NOTE: Use http://closure-compiler.appspot.com/home to compress
 *		- Whitespace only
 *		
 *	NOTE: Using a compressor for this source will likely produce errors where eval()
 *		is used and will require the variable names be changed manually
 *	
 */

window.$$ = function(){};
	
(function(window, undefined){
	"use strict";
	
	
	
	
	//Polyfills
	
	/**
	 * Checks if a given variable is an array
	 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray#Compatibility
	 * @param {mixed} v
	 * @returns {boolean}
	 */
	if(!Array.isArray){
		Array.isArray = function(v){
			return Object.prototype.toString.call(v) === "[object Array]";
		};
	}
	
	
	
	
    //Private static
	
    var _Penguin = function(){
    };
    
	var _Config = {
        templateDataAttribute: "data-template",
        templateMarkDataAttribute: "data-id",
        scriptMimeType: "text/penguin-template",
		scriptFor: "data-for",
        cleanDomAfterCompilation: true,
        isBuffering: false,
		jQueryCheckTimeout: 5
    };
	var _jQueryDetected = false;
	var _Original$$ = undefined;
    var _PrecompiledTemplates = {};
	var _ReadyList = [];
	var _TemplateBuffer = [];
    
	
	
	
    //Private
	
	/**
	 * EXPERIMENTAL
	 * @param {type} f
	 * @param {type} cb
	 */
	function _Async(f, ctxt, cb, i){
		window.setTimeout(function(){
			f.call(ctxt ? ctxt : null);
			if(cb) cb();
		}, typeof i === "Number" ? i : 0);
	}
	
	/**
	 * Exposes Penguin to the global scope
	 */
	function _BindGlobals(){
		
		if(typeof window.$$ !== "undefined"){
			_Original$$ = window.$$;
		}
		
		window.$$ = _Penguin;
		window.Penguin = _Penguin;
		
	};
	
	/**
	 * Function to be called which calls each $$.Ready function
	 */
	function _CallReadyList(){
		for(var i=0,l=_ReadyList.length; i<l; ++i){
			_ReadyList[i]();
		}
	};
    
	/**
	 * Defines additional jQuery functionality for templates
	 * If jQuery is not detected, nop is performed
	 */
	function _DefineJqueryPlugins(){
	
		function __define(){
		
			_jQueryDetected = typeof window.jQuery === "function";
			
			//If jQuery wasn't found, every x ms, check again
			//When it's found, define the plugin(s)
			if(!_jQueryDetected){
				window.setTimeout(__define, _Config.jQueryCheckTimeout *= 1.01);
				return;
			}
		
			jQuery.fn.extend({
				appendTemplates: function(){

					//https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#3-managing-arguments
					var args = [];
					args.length = arguments.length;
					for(var i=0,l=args.length; i<l; ++i){
						args[i] = arguments[i];
					}

					for(var i=0,l=args.length; i<l; ++i){
						if(args[i] instanceof Template || args[i] instanceof TemplateCollection){
							args[i] = args[i].Node;
						}
					}

					return this.append(args);

				}
			});
			
		};
	
		__define();
		
	};
	
    /**
     * Returns the HTML string of a node
     * @param {DOMNode} n
     * @returns {String}
     */
    function _DomNodeToString(n){
		
		//If outerHTML can be used, use it
		if("outerHTML" in n){
			return n.outerHTML;
		}
		
		//Otherwise create an element, append the node, and use its innerHTML
		var div = document.createElement("div");
		div.appendChild(n.cloneNode(true));
		return div.innerHTML;
		
    };
    
	/**
	 * Returns an array of elements descendant from the given element with a given attribute
	 * @param {Element} elem
	 * @param {String} attr
	 * @returns {Array}
	 */
    function _GetElementsByAttribute(elem, attr){
        
        var arr = [];
        var all = elem.getElementsByTagName("*");
        
        for(var i=0,l=all.length; i<l; ++i){
            if(all[i].hasAttribute(attr)){
                arr.push(all[i]);
            }
        }
        
        return arr;
		
    };
    
	/**
	 * Returns an object containing the marked elements within a node
	 * @param {DOMNode} el Element or Document Fragment
	 * @returns {Object}
	 */
    function _GetMarkedElements(el){

        var next = el;
		var marks = {};
		var node;
        
        while((node = next)){
            
            if(node.nodeType === Node.ELEMENT_NODE && node.hasAttribute(_Config.templateMarkDataAttribute)){
				marks[node.getAttribute(_Config.templateMarkDataAttribute)] = node;				
            }
            
            next = node.firstChild || node.nextSibling;
            
            while(next === null && (node = node.parentNode)){
                next = node.nextSibling;
            }
            
        }
		
		return marks;
        
    };
    
	/**
	 * Parses a given HTML string into a document fragment
	 * @see Modified from http://ejohn.org/blog/pure-javascript-html-parser/
	 * @param {String} html
	 * @returns {DocumentFragment}
	 */
	var _HTMLtoFragment = (function(){

		function makeMap(str){

			var obj = {};
			var items = str.split(",");

			for(var i=0,l=items.length; i<l; ++i){
				obj[items[i]] = true;
			}

			return obj;
			
		};

		function HTMLParser(html, handler){

			function parseEndTag(tag, tagName){

				var pos;

				// If no tag name is provided, clean shop
				if(!tagName){
					pos = 0;
				}
				else{

					// Find the closest opened tag of the same type
					for(pos=stack.length - 1; pos >= 0; --pos){
						if(stack[pos] === tagName){
							break;
						}
					}

				}

				if(pos >= 0){

					// Close all the open elements, up the stack
					for(var i=stack.length-1; i >= pos; --i){
						if(handler.end){
							handler.end(stack[i]);
						}
					}

					// Remove the open elements from the stack
					stack.length = pos;

				}

			};

			function parseStartTag(tag, tagName, rest, unary){

				var attrs = [];

				tagName = tagName.toLowerCase();

				if(block[tagName]){
					while(stack.last() && inline[stack.last()]){
						parseEndTag("", stack.last());
					}
				}

				if(closeSelf[tagName] && stack.last() === tagName){
					parseEndTag("", tagName);
				}

				unary = empty[tagName] || !!unary;

				if(!unary){
					stack.push(tagName);
				}

				if(handler.start){

					attrs.length = 0;

					rest.replace(attr, function(match, name){

						var value =
							arguments[2] ? arguments[2] :
							arguments[3] ? arguments[3] :
							arguments[4] ? arguments[4] :
							fillAttrs[name] ? name : "";

						attrs.push({
							name: name,
							value: value,
							escaped: value.replace(/(^|[^\\])"/g, '$1\\\"')
						});

					});

					if(handler.start){
						handler.start(tagName, attrs, unary);
					}

				}

			};

			var index;
			var chars;
			var match; 
			var stack = [];
			var last = html;

			stack.last = function(){
				return this[this.length - 1];
			};

			while(html){

				chars = true;

				// Make sure we're not in a script or style element
				if(!stack.last() || !special[stack.last()]){

					if(html.indexOf("<!--") === 0){

						//Comment
						index = html.indexOf("-->");

						if(index >= 0 ){

							if(handler.comment){
								handler.comment(html.substring(4, index));
							}

							html = html.substring(index + 3);

							chars = false;

						}

					}
					else if(html.indexOf("</") === 0){

						//end tag
						match = html.match(endTag);

						if(match) {
							html = html.substring(match[0].length);
							match[0].replace(endTag, parseEndTag);
							chars = false;
						}

					}
					else if(html.indexOf("<") === 0){

						//start tag
						match = html.match(startTag);
						
						if(match){
							html = html.substring(match[0].length);
							match[0].replace(startTag, parseStartTag);
							chars = false;
						}

					}

					if(chars){

						index = html.indexOf("<");

						var text = index < 0 ? html : html.substring(0, index);
						html = index < 0 ? "" : html.substring(index);

						if(handler.chars){
							handler.chars(text);
						}

					}

				}
				else{

					html = html.replace(new RegExp("(.*)<\/" + stack.last() + "[^>]*>"), function(all, text){

						text = text.replace(/<!--(.*?)-->/g, "$1").replace(/<!\[CDATA\[(.*?)]]>/g, "$1");

						if(handler.chars){
							handler.chars(text);
						}

						return "";

					});

					parseEndTag("", stack.last());

				}

				if(html === last){
					throw "Parse Error: " + html;
				}

				last = html;

			}

			//Clean up any remaining tags
			parseEndTag();

		};

		//Regular Expressions for parsing tags and attributes
		var startTag = /^<([-A-Za-z0-9_]+)((?:\s+[\w-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/;
		var endTag = /^<\/([-A-Za-z0-9_]+)[^>]*>/;
		var attr = /([-A-Za-z0-9_]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g;
		var empty = makeMap("area,base,basefont,br,col,embed,frame,hr,img,input,isindex,keygen,link,menuitem,meta,param,source,track,wbr,embed");
		var block = makeMap("address,applet,article,aside,audio,blockquote,button,canvas,center,dd,del,dir,div,dl,dt,fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,header,hgroup,frameset,hr,iframe,ins,isindex,li,map,menu,noframes,noscript,object,ol,output,p,pre,section,script,table,tbody,td,tfoot,th,thead,tr,ul,video");
		var inline = makeMap("a,abbr,acronym,applet,b,basefont,bdo,big,br,button,cite,code,del,dfn,em,font,i,iframe,img,input,ins,kbd,label,map,object,q,s,samp,script,select,small,span,strike,strong,sub,sup,textarea,tt,u,var");
		var closeSelf = makeMap("colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr");
		var fillAttrs = makeMap("checked,compact,declare,defer,disabled,ismap,multiple,nohref,noresize,noshade,nowrap,readonly,selected");
		var special = makeMap("script,style");

		return function(html){

			var frag = document.createDocumentFragment();
			var elems = [];
			var curParentNode = frag;

			//Push the fragment onto the stack
			elems[0] = frag;
			
			HTMLParser(html, {

				start: function(tagName, attrs, unary) {

					var elem = document.createElement(tagName);

					for(var attr in attrs){
						elem.setAttribute(attrs[attr].name, attrs[attr].value);
					}

					curParentNode.appendChild(elem);

					//Keep track of non-void elements
					if(!unary) {
						elems.push(elem);
						curParentNode = elem;
					}

				},
				end: function(tag){

					elems.length -= 1;

					//If it's not an empty tag, the previous parent should be used
					if(!empty[tag]){
						curParentNode = elems[elems.length - 1];
					}

				},
				chars: function(text){
					curParentNode.appendChild(document.createTextNode(text));
				},
				comment: function(text){

					//Create comment node
					var comm = document.createComment(text);

					if(curParentNode){
						curParentNode.appendChild( comm );
					}
					else{
						elems.push(comm);
					}

				}

			});

			return frag;

		};

	})();
	
	/**
	 * Initialisation function; always call this
	 */
	function _Initialise(){
		
		function __ready(){
			_PrecompileTemplates();
			_DefineJqueryPlugins();
			_CallReadyList();
		};

		_jQueryDetected = typeof window.jQuery === "function";

		if(_jQueryDetected){
			jQuery(document).ready(__ready);
		}
		else{
			document.addEventListener("DOMContentLoaded", __ready, false);
		}
		
	};
	
    /**
    * Checks if a given variable is a DOM Element
	* @see http://stackoverflow.com/a/384380/570787
    * @param {HTMLElement|mixed} o 
    * @return {bool}
    */
    function _IsElement(o){
        return (
            typeof HTMLElement === "object"
				? o instanceof HTMLElement
				: o && typeof o === "object" && o !== null && o.nodeType === Node.ELEMENT_NODE && typeof o.nodeName === "string"
        );
    };
	
	/**
	 * No operation function
	 */
	function _NOP(){
	};
	
    /**
     * Parses a string of HTML and returns a DocumentFragment object
     * @param {string} html
     * @returns {DocumentFragment}
     */
    function _ParseHTML(html){
		return _HTMLtoFragment(html);        
    };
	
	/**
	 * Creates templates from any defined models and logical components on the page
	 */
    function _PrecompileTemplates(){

        //1. Get all elements with a data-template attribute
		var elems = _GetElementsByAttribute(document, _Config.templateDataAttribute);
        var scripts = (function(){

            var o = {};
			var sourceArr = [];
			var scriptElems = Array.prototype.slice.call(document.scripts);
			var validScripts = [];
			
			//Get the valid scripts
			for(var i=0,l=scriptElems.length; i<l; ++i){
				if(scriptElems[i].hasAttribute(_Config.scriptFor) && scriptElems[i].type.toLowerCase() === _Config.scriptMimeType){
					validScripts.push(scriptElems[i]);
				}
			}
			
			sourceArr.length = validScripts.length;
			
            for(var i=0,l=validScripts.length; i<l; ++i){
                
				//Remove any trailing semicolons (they're not valid when placed in an array)
				sourceArr[i] = validScripts[i].textContent.replace(/(?!})\s*;\s*$/, "");
				
				//Set a property to come back to
				o[i] = validScripts[i].getAttribute(_Config.scriptFor);
				
				//Check if it should be removed from the DOM
				if(_Config.cleanDomAfterCompilation){
					validScripts[i].parentNode.removeChild(validScripts[i]);
				}
                
            }
			
			//Batch process all scripts/functions
			eval("sourceArr=[" + sourceArr.join(",") + "]");
			
			//Assign the functions to the object with the corresponding name
			for(var i=0,l=sourceArr.length; i<l; ++i){
				o[o[i]] = sourceArr[i];
			}
			
            return o;
        
        })();
        
        //2. For each, construct a template, and store it statically
        var name;
		var model;
        
        for(var i=0,l=elems.length; i<l; ++i){
            
            name = elems[i].getAttribute(_Config.templateDataAttribute);
			
			//If the element is a <template>, use it
			if(elems[i].nodeName.toLowerCase() === "template"){
				
				//If content property exists, use the fragment from it
				if("content" in elems[i]){
					model = elems[i].content;
				}
				else{
					//If content not supported, use innerHTML and parse it later
					//https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template#Browser_compatibility
					model = elems[i].innerHTML;
				}
				
			}
			else{
				model = elems[i];
			}
			
            _PrecompiledTemplates[name] = _Penguin.Create(model, name in scripts ? scripts[name] : null);
            
            if(_Config.cleanDomAfterCompilation){
                elems[i].parentNode.removeChild(elems[i]);
            }
            
        }
        
    };
	
	
	
	
	//Classes
    
	/**
	 * Creates an instance of a template
	 * @constructor
	 * @param {Object} o Object containing a DOMNode (Model) and an optional logical component (Logic)
	 */
    function Template(o){

        this._original = o.Model;
        this._node = o.Model.cloneNode(true);
		this._marks = _GetMarkedElements(this._node);
        this._func = typeof o.Logic === "function" ? o.Logic : null;
        
        if(_Config.isBuffering){
            _TemplateBuffer.push(this);
        }
        
    };
    
    Object.defineProperties(Template.prototype, {
        
		_original: {
			value: null,
			enumerable: false,
			writable: true
		},
		
		_node: {
			value: null,
			writable: true,
			configurable: false
		},
		
		_marks: {
			value: null,
			writable: true,
			enumerable: false
		},
		
		_func: {
			value: null,
			writable: true,
			enumerable: false
		},
		
		/**
         * Appends the template to a given node
         * @param {DOMNode} el
         * @returns {Template}
         */
        AppendTo: {
            value: function(n){

				if(typeof n === "string"){
					n = document.getElementById(n);
				}
				
                n.appendChild(this._node);
				
                return this;
				
            },
			enumerable: true
        },
        
		/**
		 * Appends the template to the given node asynchronously with an optional callback when complete
		 * @param {Element|DOMNode} n
		 * @param {Function} cb
		 */
		AppendToAsync: {
			value: function(n, cb){
				_Async(function(){ this.AppendTo(n); }, this, cb);
				return this;
			}
		},
		
		/**
		 * Cleans the template by removing Penguin metadata
		 * @returns {Template}
		 */
		Clean: {
			value: function(){
				
				if(!(this._node instanceof DocumentFragment)){
					this._node.removeAttribute(_Config.templateDataAttribute);
				}
				
				for(var mark in this._marks){
					this._marks[mark].removeAttribute(_Config.templateMarkDataAttribute);
				}
				
				return this;
				
			},
			enumerable: true
		},
		
		/**
		 * Same as Clean, asynchronous
		 * @param {Function} cb callback
		 */
		CleanAsync: {
			value: function(cb){
				_Async(function(){ this.Clean(); }, this, cb);
				return this;
			}
		},
		
		/**
         * Creates a copy of the template
         * @returns {Template} A new template
         */
        Copy: {
            value: function(){
                return new Template({
                    Type: "copy",
                    Model: this._original,
                    Logic: this._func
                });
            },
			enumerable: true
        },
		
		/**
		 * Same as Copy, asynchronous
		 * @param {Function} cb
		 */
		CopyAsync: {
			value: function(cb){
				_Async(function(){ cb(this.Copy()); }, this);
				return this;
			}
		},
		   
		/**
         * Calls the logical component of the template to bind data to elements
         * @param All variables passed to the bound function, with the last being the Template itself
         * @returns {Template}
         */
        DataBind: {
            value: function(){

				if(typeof this._func === "function"){
					
					//https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#3-managing-arguments
					var args = [];
					args.length = arguments.length;
					
					for(var i=0,l=args.length; i<l; ++i){
						args[i] = arguments[i];
					}
					
					this._func.apply(this, args);
					
				}
				
                return this;
				
            },
			enumerable: true
        },
		
		/**
		 * Same as DataBind, async
		 * @param {Array} args Array of values to bind
		 * @param {Function} cb
		 */
		DataBindAsync: {
			value: function(args, cb){
				_Async(function(){ this.DataBind.call(this, args); }, this, cb);
				return this;
			}	
		},
        
		/**
		 * Creates a template for each item in the given collection and returns a TemplateCollection
		 * @param {Array} coll Array of items to be bound to templates
		 */
		DataBindCollection: {
			value: function(coll){
			
				var t;
				var arr = [];
				arr.length = coll.length;
				
				for(var i=0,l=coll.length; i<l; ++i){
					t = this.Copy();
					t.DataBind.apply(t, [coll[i], i, coll]);
					arr[i] = t;
				}
				
				return new TemplateCollection(arr);
				
			},
			enumerable: true
		},
        
		/**
		 * Same as DataBindCollect, asynchronous
		 * @param {Array} coll Array of items to be bound to templates
		 * @param {Function} cb
		 */
		DataBindCollectionAsync: {
			value: function(coll, cb){
				_Async(function(){ this.DataBindCollection(coll); }, this, cb);
				return this;
			}
		},
		
		/**
         * Access the underlying node in the template
         * @returns {DOMNode|DocumentFragment|HTMLElement}
         */
        Node: {
            get: function(){
                return this._node;
            },
			enumerable: true
        },
        
		/**
         * Accesses a marked element by name
         * @param {String} name
         * @returns {HTMLElement}
         */
        Get: {
			value: function(name){
				return this._marks[name];
           },
			enumerable: true
        },
        	
		/**
		 * Access the logical component of this template
		 * @param {function} f New logical component to use
		 */
		Logic: {
			value: function(f){
				
				if(typeof f === "function"){
					this._func = f;
					return this;
				}
				else{
					return this._func;
				}
				
			},
			enumerable: true
		},
		
        /**
         * Set one or multiple marked elements
         * @param {String|Object} arguments[0]
         * @param {String|Function} arguments[1]
         * @returns {Template}
         */
        Set: {
			value: function(a, b, c){

				//Signatures:
				//1. a:string mark, b:string prop, c:string|number|array|function|bool value
				//	Set the property to the given value
				//2. a:string mark, b:string|bool|array|number value
				//	Set the textContent of the element to the given value
				//3. a:string mark, b:object { string|JSID property: string|bool|array|number value [, property: value [, property: value]] }
				//	For each object in b, set the property given as the key for the object and object's value as the element property, for the marked element
				//4. a:string mark, b:function this(HTMLElement) (t:Template)
				//	Invoke function b, setting its this pointer to the marked element, passing in an argument t which is the current Template instance
				//5. a:function this(Template)
				//	Invoke function a, setting its this pointer to the current template
				//6. a:object { string|JSID mark: string|bool|array|number|object|function value [, mark: value [, etc...]] }
				//	For each nested key, value in object a, access the marked element mark
				//	If x.value is a string, bool, array, or number, set the marked element to x.value
				//	ElseIf x.value is an object, use each key to refer to a property and value to set each property to
				//	ElseIf x.value is a function, invoke x.value, setting its this pointer to the marked element, passing in an argument t which is the current Template instance
				//

				var mods = [];
				var modType;
				var markedElem;
				
				if(arguments.length === 1){

					if(typeof a === "function"){
						//5.
						a.call(this);
					}
					else if(typeof a === "object"){

						//6.
						for(var mark in a){
							
							markedElem = this._marks[mark];
							
							if(typeof a[mark] === "object"){
								
								for(var subMark in a[mark]){
									mods.push({
										Mark: markedElem,
										Property: subMark,
										Value: a[mark][subMark]
									});
								}
								
							}
							else{				
								mods.push({
									Mark: markedElem,
									Property: null,
									Value: a[mark]
								});
							}
							
						}

					}

				}
				else if(arguments.length === 2){
					//2, 3, 4, 

					markedElem = this._marks[a];

					if(typeof b === "function"){
						//4.
						b.call(markedElem, this);
					}
					else if(typeof b === "object" && Array.isArray(b) === false){
						
						//3.
						for(var prop in b){
							mods.push({
								Mark: markedElem,
								Property: prop,
								Value: b[prop]
							});
						}

					}
					else{
						mods.push({
							Mark: markedElem,
							Property: null,
							Value: b
						});
					}

				}
				else if(arguments.length === 3){
					//1.
					mods.push({
						Mark: this._marks[a],
						Property: b,
						Value: c
					});
				}
				else{
					console.log("Incorrect number of parameters");
				}

				for(var i=0,l=mods.length; i<l; ++i){

					if(mods[i].Mark === undefined){
						console.log("Marked element not found");
						continue;
					}

					modType = typeof mods[i].Value;

					//If there is no property, then the modification is for the element itself
					if(mods[i].Property === null){

						if(modType === "string" || modType === "boolean" || modType === "number"){
							mods[i].Mark.textContent = mods[i].Value;
						}
						else if(modType === "function"){
							mods[i].Value.call(mods[i].Mark, this);
						}
						else if(Array.isArray(mods[i].Value)){
							mods[i].Mark.textContent = mods[i].Value.join(", ");
						}
						else{
							console.log("Modification type of element not supported: " + modType);
						}

					}
					else{
						
						//If the element has a property, set it, otherwise set the value as an attribute
						if(mods[i].Property in mods[i].Mark){
							mods[i].Mark[mods[i].Property] = mods[i].Value;
						}
						else{
							mods[i].Mark.setAttribute(mods[i].Property, mods[i].Value);
						}
						
					}

				}

				return this;

			},
			enumerable: true
        },
        
        /**
         * Retuens a JSON formatted representation of the template
		 * Don't call this directly, use JSON.stringify on the template instance
         * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#toJSON_behavior
         * @returns {String}
         */
        toJSON: {
            value: function(){
                return {
					Type: "json",
                    Model: _DomNodeToString(this._original),
                    Logic: typeof this._func === "function" ? this._func.toString() : null
                };
            },
			enumerable: true
        },
		
		/**
		 * Asynchronous method for generating a JSON string for this template
		 * @param {Function} cb
		 */
		toJSONStringAsync: {
			value: function(cb){
				_Async(function(){ cb(JSON.stringify(this)); }, this);
				return this;
			}
		}
        
    });
	
	
	/**
	 * Represents a collection of templates with bound content
	 * @constructor
	 * @param {Array} arr An array of templates
	 * @returns {TemplateCollection}
	 */
	function TemplateCollection(arr){
		this._Arr = arr;
	};
	
	Object.defineProperties(TemplateCollection.prototype, {
	
		_Arr: {
			value: [],
			enumerable: false,
			writable: true
		},
	
		/**
		 * Appends the collection to a given node
		 * @param {String|DOMNode} el If a string, an element id
		 * @returns {TemplateCollection}
		 */
		AppendTo: {
			value: function(n){
				
				if(typeof n === "string"){
					n = document.getElementById(n);
				}
				
				if(this._Arr.length > 1){
					n.appendChild(this.ToFragment());
				}
				else if(this._Arr.length === 1){
					n.appendChild(this._Arr[i].Node);
				}
				
				return this;
				
			},
			enumerable: true
		},
		
		/**
         * Progressively appends the buffered templates to the document
         * @param {DOMElement|string} n Element to append the buffered templates to
		 * @param {Number} ival Interval in milliseconds between each append process
         * @param {function} cb Function to be called when this process is complete
         * @returns {Penguin}
         */
        AppendToAsync: {
            value: function(n, ival, cb){
                
				if(typeof n === "string"){
					n = document.getElementById(n);
				}
				
				if(typeof ival !== "number"){
					ival = 0;
				}
				
                if(typeof cb !== "function"){
					cb = _NOP;
				}
                
				var _self = this;
                var f = document.createDocumentFragment();
                var i = 0;
                var l = _self._Arr.length;
                var chunkSize = Math.ceil(l * 0.1); //10% of total elements
                var _process = function(){
                    
                    //1. Calculate number of elements to append in forthcoming loop
                    var max = Math.min((i + chunkSize), l);
                    
                    //2. Append them
                    for(; i < max; ++i){
                        f.appendChild(_self._Arr[i].Node);
                    }
                    
					//Append the chunk to the target node
                    n.appendChild(f);
                    
                    //3. If not at the end, set up another fragment and append again
                    if(i < l){
                        f = document.createDocumentFragment();
                        window.setTimeout(_process, ival);
                    }
                    else{
                        cb.call(_self);
                    }
                    
                };
                
                _process();
                
				return this;
				
            },
			enumerable: true
        },
		
		/**
		 * Generates a Node representing the collection
		 * @returns {DocumentFragment}
		 */
		Node: {
			get: function(){
				return this.ToFragment();
			},
			enumerable: true
		},
		
		/**
		 * Returns the template at the given index of the collection
		 * @returns {Template}
		 */
		Item: {
			value: function(i){
				return this._Arr[i];
			},
			enumerable: true
		},
		
		/**
		 * Returns the number of templates in the collection
		 * @returns {Number}
		 */
		Length: {
			get: function(){
				return this._Arr.length;
			},
			enumerable: true
		},
		
		/**
		 * Adds a template to the end of the collection
		 * @returns {TemplateCollection}
		 */
		Push: {
			value: function(t){
				
				if(t instanceof Template){
					this._Arr.push(t);
				}
				
				return this;
				
			},
			enumerable: true
		},
		
		/**
		 * Adds the Node of each template to a new DocumentFragment and returns it
		 * @returns {DocumentFragment}
		 */
		ToFragment: {
			value: function(){
				
				var f = document.createDocumentFragment();
				
				for(var i=0,l=this._Arr.length; i<l; ++i){
					f.appendChild(this._Arr[i].Node);
				}
				
				return f;
				
			}
		},
		
		/**
		 * Returns an array containing each template
		 * @returns {Array}
		 */
		ToArray: {
			value: function(){
				return this._Arr.slice(0);
			}
		}
		
	});
	
	
	
	
    //Public static
	
    Object.defineProperties(_Penguin, {
       
	    /**
		 * Object containing functions for manipulating the template buffer
		 */
		Buffer: {
			value: {},
			enumerable: true
		},
	   
        /**
        * Create a template from a string of html or element, and a string or function
        * @param {DOMNode|String} model
        * @param {Function|String} logic
        * @returns {Template}
        */
        Create: {
            value: function(){

				//Signatures:
				//
				//1 argument, object { Model, Logic }
				//
				//1 argument, string|element
				//
				//2 arguments, string|element, string|function
				//

                var elem;
                var func = null;
				
				if(arguments.length === 1){
					
					if(typeof arguments[0] === "object"){
						elem = arguments[0].Model;
						func = arguments[0].Logic;
					}
					else{
						elem = arguments[0];
					}
					
				}
				else if(arguments.length === 2){
					elem = arguments[0];
					func = arguments[1];
				}
               
				//If model is a string, convert it to an element
				if(typeof elem === "string"){
                    elem = _ParseHTML(elem);
                }
				else if(elem.nodeName.toLowerCase() === "template"){
					
					//Check if the element is a <template>, and get the doc frag
					if("content" in elem){
						elem = elem.content;
					}
					else{
						elem = _ParseHTML(elem.innerHTML);
					}
					
				}

				//If logic is a string, convert it to a function
                if(typeof func === "string"){
                    eval("func=" + func);
                }

                return new Template({
					Type: "new",
					Model: elem,
					Logic: func
				});

            },
			enumerable: true
        },
        
        /**
         * Get a copy of a precompiled template on the page
         * @param {String} name Name of a precompiled template
         * @returns {Template}
         */
        Get: {
            value: function(name){
                return _PrecompiledTemplates[name].Copy();
            },
			enumerable: true
        },
		
		GetAsync: {
			value: function(name, cb){
				_Async(function(){ cb(this.Get(name)); }, _Penguin);
				return _Penguin;
			}
		},
        
		/**
		 * On demand jQuery support
		 * @returns {Penguin}
		 */
		jQuerySupport: {
			value: function(){
				_DefineJqueryPlugins();
				return _Penguin;
			},
			enumerable: true
		},
		
		/**
		 * Returns the original variable bound to window.$$ before Penguin uses it
		 * @returns {Mixed}
		 */
		Original$$: {
			get: function(){
				return _Original$$;
			},
			enumerable: true
		},
	
		/**
		 * Adds a new function to the ready list to be called when the document can be scripted
		 * @param {Function} f
		 * @returns {Penguin}
		 */
		Ready: {
			value: function(f){
				
				if(typeof f === "function"){
					_ReadyList.push(f);
				}
				
				return _Penguin;
				
			},
			enumerable: true
		}
		
	});
	
	Object.defineProperties(_Penguin.Buffer, {
		
		/**
		 * Clears all templates from the buffer
		 * @returns {Penguin}
		 */
		Clear: {
			value: function(){
				_TemplateBuffer.length = 0;
				return _Penguin;
			},
			enumerable: true
		},
		
		/**
		 * Disables buffering
		 * @returns {_Penguin}
		 */
		Disable: {
			value: function(){
				_Config.isBuffering = false;
				return _Penguin;
			},
			enumerable: true
		},
		
		/**
		 * Activate buffering
		 * @returns {_Penguin}
		 */
		Enable: {
			value: function(){
				_Config.isBuffering = true;
				return _Penguin;
			},
			enumerable: true
		},
		
		/**
		 * Whether buffering is currently active
		 * @param {boolean}
		 * @returns {Boolean}
		 */
		Enabled: {
			get: function(){
				return _Config.isBuffering;
			},
			set: function(v){
				_Config.isBuffering = v ? true : false;
				return _Config.isBuffering;
			},
			enumerable: true
		},
		
		/**
         * Return a TemplateCollection containing all buffered templates
         * @returns {TemplateCollection}
         */
        Collection: {
			get: function(){
            
                var arr = [];
				arr.length = _TemplateBuffer.length;

                for(var i=0,l=_TemplateBuffer.length; i<l; ++i){
                    arr[i] = _TemplateBuffer[i];
                }

                return new TemplateCollection(arr);

           },
			enumerable: true
        },
		
		/**
		 * Numbers of templates currently in the buffer
		 * @returns {Number}
		 */
		Length: {
			get: function(){
				return _TemplateBuffer.length;
			},
			enumerable: true
		},
		
		/**
		 * Adds another template to the end of the buffer
		 * @returns {Penguin}
		 */
		Push: {
			value: function(t){
				
				if(t instanceof Template){
					_TemplateBuffer.push(t);
				}
				
				return _Penguin;
				
			},
			enumerable: true
		}
		
	});
	
	
	
	
	//----------------No more definitions below here----------------
	
	_BindGlobals();
	_Initialise();
	
})(window);