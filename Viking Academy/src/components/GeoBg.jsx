const GeoBg = () => (
  <svg style={{ position:"fixed", inset:0, width:"100%", height:"100%", pointerEvents:"none", opacity:0.04, zIndex:0 }} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="hexP" x="0" y="0" width="80" height="92" patternUnits="userSpaceOnUse">
        <polygon points="40,4 76,24 76,68 40,88 4,68 4,24" fill="none" stroke="#4A9EFF" strokeWidth="0.5"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#hexP)"/>
  </svg>
);

export default GeoBg;
