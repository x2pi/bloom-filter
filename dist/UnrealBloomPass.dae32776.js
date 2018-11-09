// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles

// eslint-disable-next-line no-global-assign
parcelRequire = (function (modules, cache, entry, globalName) {
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof parcelRequire === 'function' && parcelRequire;
  var nodeRequire = typeof require === 'function' && require;

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire = typeof parcelRequire === 'function' && parcelRequire;
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error('Cannot find module \'' + name + '\'');
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = cache[name] = new newRequire.Module(name);

      modules[name][0].call(module.exports, localRequire, module, module.exports, this);
    }

    return cache[name].exports;

    function localRequire(x){
      return newRequire(localRequire.resolve(x));
    }

    function resolve(x){
      return modules[name][1][x] || x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [function (require, module) {
      module.exports = exports;
    }, {}];
  };

  for (var i = 0; i < entry.length; i++) {
    newRequire(entry[i]);
  }

  if (entry.length) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(entry[entry.length - 1]);

    // CommonJS
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = mainExports;

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
     define(function () {
       return mainExports;
     });

    // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }

  // Override the current require with this new one
  return newRequire;
})({"js/postprocessing/UnrealBloomPass.js":[function(require,module,exports) {
/**
 * @author spidersharma / http://eduperiment.com/
 *
 * Inspired from Unreal Engine
 * https://docs.unrealengine.com/latest/INT/Engine/Rendering/PostProcessEffects/Bloom/
 */
THREE.UnrealBloomPass = function (resolution, strength, radius, threshold) {
  THREE.Pass.call(this);
  this.strength = strength !== undefined ? strength : 1;
  this.radius = radius;
  this.threshold = threshold;
  this.resolution = resolution !== undefined ? new THREE.Vector2(resolution.x, resolution.y) : new THREE.Vector2(256, 256); // create color only once here, reuse it later inside the render function

  this.clearColor = new THREE.Color(0, 0, 0); // render targets

  var pars = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat
  };
  this.renderTargetsHorizontal = [];
  this.renderTargetsVertical = [];
  this.nMips = 5;
  var resx = Math.round(this.resolution.x / 2);
  var resy = Math.round(this.resolution.y / 2);
  this.renderTargetBright = new THREE.WebGLRenderTarget(resx, resy, pars);
  this.renderTargetBright.texture.name = "UnrealBloomPass.bright";
  this.renderTargetBright.texture.generateMipmaps = false;

  for (var i = 0; i < this.nMips; i++) {
    var renderTarget = new THREE.WebGLRenderTarget(resx, resy, pars);
    renderTarget.texture.name = "UnrealBloomPass.h" + i;
    renderTarget.texture.generateMipmaps = false;
    this.renderTargetsHorizontal.push(renderTarget);
    var renderTarget = new THREE.WebGLRenderTarget(resx, resy, pars);
    renderTarget.texture.name = "UnrealBloomPass.v" + i;
    renderTarget.texture.generateMipmaps = false;
    this.renderTargetsVertical.push(renderTarget);
    resx = Math.round(resx / 2);
    resy = Math.round(resy / 2);
  } // luminosity high pass material


  if (THREE.LuminosityHighPassShader === undefined) console.error("THREE.UnrealBloomPass relies on THREE.LuminosityHighPassShader");
  var highPassShader = THREE.LuminosityHighPassShader;
  this.highPassUniforms = THREE.UniformsUtils.clone(highPassShader.uniforms);
  this.highPassUniforms["luminosityThreshold"].value = threshold;
  this.highPassUniforms["smoothWidth"].value = 0.01;
  this.materialHighPassFilter = new THREE.ShaderMaterial({
    uniforms: this.highPassUniforms,
    vertexShader: highPassShader.vertexShader,
    fragmentShader: highPassShader.fragmentShader,
    defines: {}
  }); // Gaussian Blur Materials

  this.separableBlurMaterials = [];
  var kernelSizeArray = [3, 5, 7, 9, 11];
  var resx = Math.round(this.resolution.x / 2);
  var resy = Math.round(this.resolution.y / 2);

  for (var i = 0; i < this.nMips; i++) {
    this.separableBlurMaterials.push(this.getSeperableBlurMaterial(kernelSizeArray[i]));
    this.separableBlurMaterials[i].uniforms["texSize"].value = new THREE.Vector2(resx, resy);
    resx = Math.round(resx / 2);
    resy = Math.round(resy / 2);
  } // Composite material


  this.compositeMaterial = this.getCompositeMaterial(this.nMips);
  this.compositeMaterial.uniforms["blurTexture1"].value = this.renderTargetsVertical[0].texture;
  this.compositeMaterial.uniforms["blurTexture2"].value = this.renderTargetsVertical[1].texture;
  this.compositeMaterial.uniforms["blurTexture3"].value = this.renderTargetsVertical[2].texture;
  this.compositeMaterial.uniforms["blurTexture4"].value = this.renderTargetsVertical[3].texture;
  this.compositeMaterial.uniforms["blurTexture5"].value = this.renderTargetsVertical[4].texture;
  this.compositeMaterial.uniforms["bloomStrength"].value = strength;
  this.compositeMaterial.uniforms["bloomRadius"].value = 0.1;
  this.compositeMaterial.needsUpdate = true;
  var bloomFactors = [1.0, 0.8, 0.6, 0.4, 0.2];
  this.compositeMaterial.uniforms["bloomFactors"].value = bloomFactors;
  this.bloomTintColors = [new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1)];
  this.compositeMaterial.uniforms["bloomTintColors"].value = this.bloomTintColors; // copy material

  if (THREE.CopyShader === undefined) {
    console.error("THREE.BloomPass relies on THREE.CopyShader");
  }

  var copyShader = THREE.CopyShader;
  this.copyUniforms = THREE.UniformsUtils.clone(copyShader.uniforms);
  this.copyUniforms["opacity"].value = 1.0;
  this.materialCopy = new THREE.ShaderMaterial({
    uniforms: this.copyUniforms,
    vertexShader: copyShader.vertexShader,
    fragmentShader: copyShader.fragmentShader,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true
  });
  this.enabled = true;
  this.needsSwap = false;
  this.oldClearColor = new THREE.Color();
  this.oldClearAlpha = 1;
  this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  this.scene = new THREE.Scene();
  this.basic = new THREE.MeshBasicMaterial();
  this.quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), null);
  this.quad.frustumCulled = false; // Avoid getting clipped

  this.scene.add(this.quad);
};

THREE.UnrealBloomPass.prototype = Object.assign(Object.create(THREE.Pass.prototype), {
  constructor: THREE.UnrealBloomPass,
  dispose: function dispose() {
    for (var i = 0; i < this.renderTargetsHorizontal.length; i++) {
      this.renderTargetsHorizontal[i].dispose();
    }

    for (var i = 0; i < this.renderTargetsVertical.length; i++) {
      this.renderTargetsVertical[i].dispose();
    }

    this.renderTargetBright.dispose();
  },
  setSize: function setSize(width, height) {
    var resx = Math.round(width / 2);
    var resy = Math.round(height / 2);
    this.renderTargetBright.setSize(resx, resy);

    for (var i = 0; i < this.nMips; i++) {
      this.renderTargetsHorizontal[i].setSize(resx, resy);
      this.renderTargetsVertical[i].setSize(resx, resy);
      this.separableBlurMaterials[i].uniforms["texSize"].value = new THREE.Vector2(resx, resy);
      resx = Math.round(resx / 2);
      resy = Math.round(resy / 2);
    }
  },
  render: function render(renderer, writeBuffer, readBuffer, delta, maskActive) {
    this.oldClearColor.copy(renderer.getClearColor());
    this.oldClearAlpha = renderer.getClearAlpha();
    var oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setClearColor(this.clearColor, 0);
    if (maskActive) renderer.context.disable(renderer.context.STENCIL_TEST); // Render input to screen

    if (this.renderToScreen) {
      this.quad.material = this.basic;
      this.basic.map = readBuffer.texture;
      renderer.render(this.scene, this.camera, undefined, true);
    } // 1. Extract Bright Areas


    this.highPassUniforms["tDiffuse"].value = readBuffer.texture;
    this.highPassUniforms["luminosityThreshold"].value = this.threshold;
    this.quad.material = this.materialHighPassFilter;
    renderer.render(this.scene, this.camera, this.renderTargetBright, true); // 2. Blur All the mips progressively

    var inputRenderTarget = this.renderTargetBright;

    for (var i = 0; i < this.nMips; i++) {
      this.quad.material = this.separableBlurMaterials[i];
      this.separableBlurMaterials[i].uniforms["colorTexture"].value = inputRenderTarget.texture;
      this.separableBlurMaterials[i].uniforms["direction"].value = THREE.UnrealBloomPass.BlurDirectionX;
      renderer.render(this.scene, this.camera, this.renderTargetsHorizontal[i], true);
      this.separableBlurMaterials[i].uniforms["colorTexture"].value = this.renderTargetsHorizontal[i].texture;
      this.separableBlurMaterials[i].uniforms["direction"].value = THREE.UnrealBloomPass.BlurDirectionY;
      renderer.render(this.scene, this.camera, this.renderTargetsVertical[i], true);
      inputRenderTarget = this.renderTargetsVertical[i];
    } // Composite All the mips


    this.quad.material = this.compositeMaterial;
    this.compositeMaterial.uniforms["bloomStrength"].value = this.strength;
    this.compositeMaterial.uniforms["bloomRadius"].value = this.radius;
    this.compositeMaterial.uniforms["bloomTintColors"].value = this.bloomTintColors;
    renderer.render(this.scene, this.camera, this.renderTargetsHorizontal[0], true); // Blend it additively over the input texture

    this.quad.material = this.materialCopy;
    this.copyUniforms["tDiffuse"].value = this.renderTargetsHorizontal[0].texture;
    if (maskActive) renderer.context.enable(renderer.context.STENCIL_TEST);

    if (this.renderToScreen) {
      renderer.render(this.scene, this.camera, undefined, false);
    } else {
      renderer.render(this.scene, this.camera, readBuffer, false);
    } // Restore renderer settings


    renderer.setClearColor(this.oldClearColor, this.oldClearAlpha);
    renderer.autoClear = oldAutoClear;
  },
  getSeperableBlurMaterial: function getSeperableBlurMaterial(kernelRadius) {
    return new THREE.ShaderMaterial({
      defines: {
        "KERNEL_RADIUS": kernelRadius,
        "SIGMA": kernelRadius
      },
      uniforms: {
        "colorTexture": {
          value: null
        },
        "texSize": {
          value: new THREE.Vector2(0.5, 0.5)
        },
        "direction": {
          value: new THREE.Vector2(0.5, 0.5)
        }
      },
      vertexShader: "varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",
      fragmentShader: "#include <common>\
				varying vec2 vUv;\n\
				uniform sampler2D colorTexture;\n\
				uniform vec2 texSize;\
				uniform vec2 direction;\
				\
				float gaussianPdf(in float x, in float sigma) {\
					return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;\
				}\
				void main() {\n\
					vec2 invSize = 1.0 / texSize;\
					float fSigma = float(SIGMA);\
					float weightSum = gaussianPdf(0.0, fSigma);\
					vec3 diffuseSum = texture2D( colorTexture, vUv).rgb * weightSum;\
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {\
						float x = float(i);\
						float w = gaussianPdf(x, fSigma);\
						vec2 uvOffset = direction * invSize * x;\
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset).rgb;\
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset).rgb;\
						diffuseSum += (sample1 + sample2) * w;\
						weightSum += 2.0 * w;\
					}\
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);\n\
				}"
    });
  },
  getCompositeMaterial: function getCompositeMaterial(nMips) {
    return new THREE.ShaderMaterial({
      defines: {
        "NUM_MIPS": nMips
      },
      uniforms: {
        "blurTexture1": {
          value: null
        },
        "blurTexture2": {
          value: null
        },
        "blurTexture3": {
          value: null
        },
        "blurTexture4": {
          value: null
        },
        "blurTexture5": {
          value: null
        },
        "dirtTexture": {
          value: null
        },
        "bloomStrength": {
          value: 1.0
        },
        "bloomFactors": {
          value: null
        },
        "bloomTintColors": {
          value: null
        },
        "bloomRadius": {
          value: 0.0
        }
      },
      vertexShader: "varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",
      fragmentShader: "varying vec2 vUv;\
				uniform sampler2D blurTexture1;\
				uniform sampler2D blurTexture2;\
				uniform sampler2D blurTexture3;\
				uniform sampler2D blurTexture4;\
				uniform sampler2D blurTexture5;\
				uniform sampler2D dirtTexture;\
				uniform float bloomStrength;\
				uniform float bloomRadius;\
				uniform float bloomFactors[NUM_MIPS];\
				uniform vec3 bloomTintColors[NUM_MIPS];\
				\
				float lerpBloomFactor(const in float factor) { \
					float mirrorFactor = 1.2 - factor;\
					return mix(factor, mirrorFactor, bloomRadius);\
				}\
				\
				void main() {\
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) + \
													 lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) + \
													 lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) + \
													 lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) + \
													 lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );\
				}"
    });
  }
});
THREE.UnrealBloomPass.BlurDirectionX = new THREE.Vector2(1.0, 0.0);
THREE.UnrealBloomPass.BlurDirectionY = new THREE.Vector2(0.0, 1.0);
},{}],"../../../AppData/Roaming/npm/node_modules/parcel-bundler/src/builtins/hmr-runtime.js":[function(require,module,exports) {
var global = arguments[3];
var OVERLAY_ID = '__parcel__error__overlay__';
var OldModule = module.bundle.Module;

function Module(moduleName) {
  OldModule.call(this, moduleName);
  this.hot = {
    data: module.bundle.hotData,
    _acceptCallbacks: [],
    _disposeCallbacks: [],
    accept: function (fn) {
      this._acceptCallbacks.push(fn || function () {});
    },
    dispose: function (fn) {
      this._disposeCallbacks.push(fn);
    }
  };
  module.bundle.hotData = null;
}

module.bundle.Module = Module;
var parent = module.bundle.parent;

if ((!parent || !parent.isParcelRequire) && typeof WebSocket !== 'undefined') {
  var hostname = "" || location.hostname;
  var protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  var ws = new WebSocket(protocol + '://' + hostname + ':' + "55663" + '/');

  ws.onmessage = function (event) {
    var data = JSON.parse(event.data);

    if (data.type === 'update') {
      console.clear();
      data.assets.forEach(function (asset) {
        hmrApply(global.parcelRequire, asset);
      });
      data.assets.forEach(function (asset) {
        if (!asset.isNew) {
          hmrAccept(global.parcelRequire, asset.id);
        }
      });
    }

    if (data.type === 'reload') {
      ws.close();

      ws.onclose = function () {
        location.reload();
      };
    }

    if (data.type === 'error-resolved') {
      console.log('[parcel] ✨ Error resolved');
      removeErrorOverlay();
    }

    if (data.type === 'error') {
      console.error('[parcel] 🚨  ' + data.error.message + '\n' + data.error.stack);
      removeErrorOverlay();
      var overlay = createErrorOverlay(data);
      document.body.appendChild(overlay);
    }
  };
}

function removeErrorOverlay() {
  var overlay = document.getElementById(OVERLAY_ID);

  if (overlay) {
    overlay.remove();
  }
}

function createErrorOverlay(data) {
  var overlay = document.createElement('div');
  overlay.id = OVERLAY_ID; // html encode message and stack trace

  var message = document.createElement('div');
  var stackTrace = document.createElement('pre');
  message.innerText = data.error.message;
  stackTrace.innerText = data.error.stack;
  overlay.innerHTML = '<div style="background: black; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; opacity: 0.85; font-family: Menlo, Consolas, monospace; z-index: 9999;">' + '<span style="background: red; padding: 2px 4px; border-radius: 2px;">ERROR</span>' + '<span style="top: 2px; margin-left: 5px; position: relative;">🚨</span>' + '<div style="font-size: 18px; font-weight: bold; margin-top: 20px;">' + message.innerHTML + '</div>' + '<pre>' + stackTrace.innerHTML + '</pre>' + '</div>';
  return overlay;
}

function getParents(bundle, id) {
  var modules = bundle.modules;

  if (!modules) {
    return [];
  }

  var parents = [];
  var k, d, dep;

  for (k in modules) {
    for (d in modules[k][1]) {
      dep = modules[k][1][d];

      if (dep === id || Array.isArray(dep) && dep[dep.length - 1] === id) {
        parents.push(k);
      }
    }
  }

  if (bundle.parent) {
    parents = parents.concat(getParents(bundle.parent, id));
  }

  return parents;
}

function hmrApply(bundle, asset) {
  var modules = bundle.modules;

  if (!modules) {
    return;
  }

  if (modules[asset.id] || !bundle.parent) {
    var fn = new Function('require', 'module', 'exports', asset.generated.js);
    asset.isNew = !modules[asset.id];
    modules[asset.id] = [fn, asset.deps];
  } else if (bundle.parent) {
    hmrApply(bundle.parent, asset);
  }
}

function hmrAccept(bundle, id) {
  var modules = bundle.modules;

  if (!modules) {
    return;
  }

  if (!modules[id] && bundle.parent) {
    return hmrAccept(bundle.parent, id);
  }

  var cached = bundle.cache[id];
  bundle.hotData = {};

  if (cached) {
    cached.hot.data = bundle.hotData;
  }

  if (cached && cached.hot && cached.hot._disposeCallbacks.length) {
    cached.hot._disposeCallbacks.forEach(function (cb) {
      cb(bundle.hotData);
    });
  }

  delete bundle.cache[id];
  bundle(id);
  cached = bundle.cache[id];

  if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
    cached.hot._acceptCallbacks.forEach(function (cb) {
      cb();
    });

    return true;
  }

  return getParents(global.parcelRequire, id).some(function (id) {
    return hmrAccept(global.parcelRequire, id);
  });
}
},{}]},{},["../../../AppData/Roaming/npm/node_modules/parcel-bundler/src/builtins/hmr-runtime.js","js/postprocessing/UnrealBloomPass.js"], null)
//# sourceMappingURL=/UnrealBloomPass.dae32776.map