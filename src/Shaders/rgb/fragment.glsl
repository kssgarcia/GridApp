uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uTransition;

varying vec2 vUv;
//2D (returns 0 - 1)
float random2d(vec2 n) { 
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

float randomRange (in vec2 seed, in float min, in float max) {
		return min + random2d(seed) * (max - min);
}

// return 1 if v inside 1d range
float insideRange(float v, float bottom, float top) {
   return step(bottom, v) - step(top, v);
}

//inputs
float AMT = 0.2; //0 - 1 glitch amount
float SPEED = 0.6; //0 - 1 speed

float noise(in vec2 st)
{
    vec2 i = floor(st);
    vec2 f = fract(st);
    
    vec2 dv = vec2(1.0, 0.0);
    
    float a = random2d(i);
    float b = random2d(i + dv.xy);
    float c = random2d(i + dv.yx);
    float d = random2d(i + dv.xx);
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    return mix(a, b, u.x) +
           (c - a) * u.y * (1.0 - u.x) +
           (d - b) * u.x * u.y;
}

void main()
{
    
    float time = floor(uTime * SPEED * 60.0);    
    
    //copy orig
    vec3 outCol = texture(tDiffuse, vUv).rgb;
    
    //randomly offset slices horizontally
    float maxOffset = AMT/2.0;
    for (float i = 0.0; i < 10.0 * AMT; i += 1.0) {
        float sliceY = random2d(vec2(time , 2345.0 + float(i)));
        float sliceH = random2d(vec2(time , 9035.0 + float(i))) * 0.25;
        float hOffset = randomRange(vec2(time , 9625.0 + float(i)), -maxOffset, maxOffset);
        vec2 uvOff = vUv;
        uvOff.x += hOffset;
        if (insideRange(vUv.y, sliceY, fract(sliceY+sliceH)) == 1.0 ){
        	outCol = texture(tDiffuse, uvOff).rgb;
        }
    }
    
    //do slight offset on one entire channel
    float maxColOffset = AMT/6.0;
    float rnd = random2d(vec2(time , 9545.0));
    vec2 colOffset = vec2(randomRange(vec2(time , 9545.0),-maxColOffset,maxColOffset), 
                       randomRange(vec2(time , 7205.0),-maxColOffset,maxColOffset));
    if (rnd < 0.33){
        outCol.r = texture(tDiffuse, vUv + colOffset).r;
        
    }else if (rnd < 0.66){
        outCol.g = texture(tDiffuse, vUv + colOffset).g;
        
    } else{
        outCol.b = texture(tDiffuse, vUv + colOffset).b;  
    }
       
    vec2 offset = noise(vec2(sin(uTime)*3000., cos(uTime)*3000.))*0.008 * vec2( cos(0.), sin(0.)) * smoothstep(0.7, 1., sin(uTime));
    // vec2 offset = 0.001 * vec2( cos(0.), sin(0.));
    
    vec4 cr = texture2D(tDiffuse, vUv + offset);
    vec4 cga = texture2D(tDiffuse, vUv);
    vec4 cb = texture2D(tDiffuse, vUv - offset);
    gl_FragColor = vec4(cr.r, cga.g, cb.b, cga.a);

	gl_FragColor += vec4(outCol,1.0) * uTransition;
} 