import './style.css'
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
// Shader
import rgbShadervertex from './Shaders/rgb/vertex.glsl';
import rgbShaderFragment from './Shaders/rgb/fragment.glsl';
import finalPassShaderVertex from './Shaders/FinalPass/vertex.glsl';
import finalPassShaderFragment from './Shaders/FinalPass/fragment.glsl';
import grainShaderVertex from './Shaders/Grain/vertex.glsl';
import grainShaderFragment from './Shaders/Grain/fragment.glsl'
import vertexShaderParticles from './Shaders/particles/vertex.glsl'
import fragmentShaderParticles from './Shaders/particles/fragment.glsl'
import FlowField from './FlowField.js'
import { Pane } from 'tweakpane'
import Time from './Utils/Time.js'

let isAndroid = false;
if( /Android|webOS|iPhone|iPad|Mac|Macintosh|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
    isAndroid = true;
}

let loadingManager;
let canvas, scene, camera, controls;
let clock;
let renderer, effectcomposer, rgbShader, grainShader;
let plane;

class HeroThree {
    constructor() 
    {
        canvas = document.querySelector('canvas.webgl');
        scene = new THREE.Scene();
        this.OnLoad();

        this.width = 540;
        this.height = 327;
        this.ratio = this.width / this.height;
        this.count = this.width * this.height;
        clock = new Time();

        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath('draco/');
        this.gltfLoader = new GLTFLoader(loadingManager);
        this.gltfLoader.setDRACOLoader(this.dracoLoader);

        // Config debug
        this.setConfig();
        this.setDebug();
        this.debugFolder = this.debug.addFolder({
            title: 'particles'
        })

        //Objects
        this.setPositions();
        this.Resize();
        this.Settings();
        this.setFlowfield();
        this.Particles();
        this.PostProcessing();
        this.Tick();
    }

    setConfig()
    {
        this.config = {}
    
        // Debug
        this.config.debug = window.location.hash === '#debug'

        // Pixel ratio
        this.config.pixelRatio = Math.min(Math.max(window.devicePixelRatio, 1), 2)

        // Width and height
        const boundings = canvas.getBoundingClientRect()
        this.config.width = boundings.width
        this.config.height = boundings.height || window.innerHeight
    }

    setDebug()
    {
        this.debug = new Pane()
        this.debug.containerElem_.style.width = '320px'
    }

    OnLoad() {
        const loadingScreen = document.getElementById( 'loading-screen' );
        loadingScreen.classList.add( 'fade-out' );
        loadingManager = new THREE.LoadingManager( () => {
            const loadingScreen = document.getElementById( 'loading-screen' );
            loadingScreen.classList.add( 'fade-out' );
        } );
    }

    setPositions()
    {
        // Set Positions
        this.positions = new Float32Array(this.count * 3);

        for(let i = 0; i < this.count; i++)
        {
            this.positions[i] = (Math.random() - 0.5) * 10
        }
    }

    setFlowfield()
    {
        this.flowField = new FlowField({ positions: this.positions, debugFolder: this.debugFolder }, renderer, clock, scene)
    }

    Particles()
    {
        // Set geometry
        const size = new Float32Array(this.count)
        const uv = new Float32Array(this.count * 2)

        for(let i = 0; i < this.count; i++)
        {
            size[i] = 0.2 + Math.random() * 0.8
        }
        
        for(let j = 0; j < this.height; j++)
        {
            for(let i = 0; i < this.width; i++)
            {
                uv[(j * this.width * 2) + (i * 2) + 0] = i / this.width
                uv[(j * this.width * 2) + (i * 2) + 1] = j / this.height
            }
        }

        this.geometry = new THREE.BufferGeometry()
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
        this.geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
        this.geometry.setAttribute('aFboUv', this.flowField.fboUv.attribute)
        this.geometry.setAttribute('aUv', new THREE.BufferAttribute(uv, 2))

        // Material
        this.material = new THREE.ShaderMaterial({
            uniforms:
            {
                uSize: { value: 50 * 1 },
                uFBOTexture: { value: this.flowField.texture },
                uTime: { uTime: 0 }
            },
            vertexShader: vertexShaderParticles,
            fragmentShader: fragmentShaderParticles
        })

        this.points = new THREE.Points(this.geometry, this.material)
        scene.add(this.points)
    }

    Resize() 
    {
        this.sizes = {
            width: window.innerWidth,
            height: window.innerHeight
        }
        
        window.addEventListener('resize', () => {
            // Update sizes
            this.sizes.width = window.innerWidth
            this.sizes.height = window.innerHeight
        
            // Update camera
            camera.aspect = this.sizes.width / this.sizes.height
            camera.updateProjectionMatrix()
        
            // Update renderer
            renderer.setSize(this.sizes.width, this.sizes.height)
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

            // Update Composer
            effectcomposer.setSize(this.sizes.width, this.sizes.height);
        })
    }

    Settings() 
    {
        camera = new THREE.PerspectiveCamera(75, this.sizes.width / this.sizes.height, 0.1, 100);     
        camera.position.set(5, 12, 12);
        // Controls
        controls = new OrbitControls(camera, canvas)
        controls.enableDamping = true

        scene.add(camera);

         renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
        })
        renderer.setSize(this.sizes.width, this.sizes.height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    }

    Tick() 
    {
        // Elapsed time
        const elapsedTime = clock.elapsed;

        // Flowfield update
        this.flowField.update()
        this.points.material.uniforms.uFBOTexture.value = this.flowField.texture
        this.points.material.uniforms.uTime.value = elapsedTime

        // Controls update
        controls.update();

        // Update Post-processing
        effectcomposer.render(); 
        rgbShader.material.uniforms.uTime.value = elapsedTime;
        grainShader.material.uniforms.amount.value += 0.01;
        
        // Call Tick again on the next frame
        window.requestAnimationFrame(this.Tick.bind(this));
    }

    PostProcessing() 
    {
        let RenderTargetClass = null
        if(renderer.getPixelRatio() === 1 && renderer.capabilities.isWebGL2) {
            RenderTargetClass = THREE.WebGLMultisampleRenderTarget
            console.log('Using WebGLMultisampleRenderTarget')
        }
        else {
            RenderTargetClass = THREE.WebGLRenderTarget
            console.log('Using WebGLRenderTarget')
        }

        const renderTarget = new RenderTargetClass(
            800,
            600,
            {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                encoding: THREE.sRGBEncoding
            }
        )

        const renderScene = new RenderPass( scene, camera )

        // Bloom Post processing
        const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
        bloomPass.threshold = 0;
        bloomPass.strength = 0.4;
        bloomPass.radius = 1;

        // RGB Post processing
        this.rgbShift = {
            uniforms: {
                tDiffuse: { value: null },
                uTime: { value: null },
                uTransition: { value: 0 }
            },
            vertexShader: rgbShadervertex,
            fragmentShader: rgbShaderFragment
        }
        rgbShader = new ShaderPass(this.rgbShift);
        rgbShader.material.uniforms.uTime.value = 0

        // Final post processing 
         this.finalPass = new ShaderPass({
            uniforms: {
                tDiffuse: { value: null },
                uNoiseMultiplier: { value: 0.03 },
                uNoiseOffset: { value: -0.1 },
                uRGBShiftMultiplier: { value: 0.004 },
                uRGBShiftOffset: { value: 0.04 },
            },
            vertexShader: finalPassShaderVertex,
            fragmentShader: finalPassShaderFragment
        })

        // Grain Post processing
        this.grainEffect = {
            uniforms: {
              tDiffuse: { value: null },
              amount: { value: null }
            },
            vertexShader: grainShaderVertex,
            fragmentShader: grainShaderFragment
        }
        grainShader = new ShaderPass(this.grainEffect)
        grainShader.material.uniforms.amount.value = 0

        // EffectComposer
        effectcomposer = new EffectComposer( renderer, renderTarget );
        effectcomposer.setSize(this.sizes.width, this.sizes.height)
        effectcomposer.addPass( renderScene );
        effectcomposer.addPass( bloomPass );
        effectcomposer.addPass( rgbShader );
        effectcomposer.addPass(this.finalPass);
        effectcomposer.addPass( grainShader );
    }
}

new HeroThree();
