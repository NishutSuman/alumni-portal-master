import{j as e}from"./ui-BlmhFX_F.js";import{r as I}from"./router-DFnE1L-t.js";import{c as j,x as y}from"./index-P8gjH_om.js";import{C as w}from"./redux-VN59sPcb.js";const v="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDY0IDY0Ij48Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIzMiIgZmlsbD0iI2U1ZTdlYiIvPjxjaXJjbGUgY3g9IjMyIiBjeT0iMjQiIHI9IjEwIiBmaWxsPSIjOWNhM2FmIi8+PHBhdGggZD0iTTEyIDU2YzAtMTEuMDQ2IDguOTU0LTIwIDIwLTIwczIwIDguOTU0IDIwIDIwIiBmaWxsPSIjOWNhM2FmIi8+PC9zdmc+",M=({images:l,speed:i="medium",pauseOnHover:r=!0,className:f=""})=>{const[o,s]=I.useState(!1),[m,c]=I.useState(new Set),n=a=>{c(u=>new Set(u).add(a))},d=a=>m.has(a.id)?v:j(a.profileImage),t=l.slice(0,15),g=l.slice(15,30),p={slow:"90s",medium:"60s",fast:"40s"}[i],x=[...t,...t,...t],h=[...g,...g,...g];return e.jsxs("div",{className:`w-full overflow-hidden relative ${f}`,children:[e.jsx("div",{className:"absolute left-0 top-0 bottom-0 w-16 sm:w-32 md:w-48 bg-gradient-to-r from-white dark:from-gray-800 to-transparent z-10 pointer-events-none"}),e.jsx("div",{className:"absolute right-0 top-0 bottom-0 w-16 sm:w-32 md:w-48 bg-gradient-to-l from-white dark:from-gray-800 to-transparent z-10 pointer-events-none"}),e.jsx("div",{className:"flex mb-6 pt-2",onMouseEnter:()=>r&&s(!0),onMouseLeave:()=>r&&s(!1),children:e.jsx("div",{className:"flex gap-8 animate-marquee-ltr",style:{animationDuration:p,animationPlayState:o?"paused":"running"},children:x.map((a,u)=>e.jsx("div",{className:"flex-shrink-0",children:e.jsx("img",{src:d(a),alt:"",className:"w-16 h-16 rounded-full object-cover shadow-lg ring-2 ring-white dark:ring-gray-700 hover:scale-110 transition-transform duration-300",loading:"lazy",onError:()=>n(a.id)})},`${a.id}-${u}`))})}),e.jsx("div",{className:"flex pb-2",onMouseEnter:()=>r&&s(!0),onMouseLeave:()=>r&&s(!1),children:e.jsx("div",{className:"flex gap-8 animate-marquee-rtl",style:{animationDuration:p,animationPlayState:o?"paused":"running"},children:h.map((a,u)=>e.jsx("div",{className:"flex-shrink-0",children:e.jsx("img",{src:d(a),alt:"",className:"w-16 h-16 rounded-full object-cover shadow-lg ring-2 ring-white dark:ring-gray-700 hover:scale-110 transition-transform duration-300",loading:"lazy",onError:()=>n(a.id)})},`${a.id}-${u}`))})}),e.jsx("style",{children:`
        @keyframes marquee-ltr {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.333333%);
          }
        }

        @keyframes marquee-rtl {
          0% {
            transform: translateX(-33.333333%);
          }
          100% {
            transform: translateX(0);
          }
        }

        .animate-marquee-ltr {
          animation: marquee-ltr linear infinite;
        }

        .animate-marquee-rtl {
          animation: marquee-rtl linear infinite;
        }
      `})]})},N=y.injectEndpoints({endpoints:l=>({getMarqueeProfiles:l.query({query:()=>"/demo/marquee-profiles?v=3",transformResponse:i=>i.data,keepUnusedDataFor:604800})}),overrideExisting:!1}),{useGetMarqueeProfilesQuery:b}=N,k=({speed:l="medium",className:i=""})=>{const{data:r,isLoading:f,error:o}=b(),{user:s}=w(c=>c.auth),m=I.useMemo(()=>{if(!r||r.length===0)return[];if(!s?.id||!s?.profileImage||r.some(t=>t.id===s.id))return r;const n=[...r];let d=-1;for(let t=n.length-1;t>=0;t--)if(n[t].type==="dummy"){d=t;break}return d!==-1&&(n[d]={id:s.id,type:"real",profileImage:`/api/users/profile-picture/${s.id}`}),n},[r,s]);return f?e.jsx("div",{className:`w-full py-8 ${i}`,children:e.jsxs("div",{className:"flex justify-center items-center",children:[e.jsx("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"}),e.jsx("span",{className:"ml-3 text-gray-600 dark:text-gray-400",children:"Loading alumni..."})]})}):(o&&console.error("Marquee error:",o),!m||m.length===0?o?e.jsx("div",{className:`w-full py-4 ${i}`,children:e.jsx("div",{className:"flex justify-center items-center text-gray-400 dark:text-gray-600 text-sm",children:e.jsx("span",{children:"Loading alumni profiles..."})})}):null:e.jsx("div",{className:i,children:e.jsx(M,{images:m,speed:l})}))};export{k as P};
//# sourceMappingURL=ProfileMarquee-wSMmydlV.js.map
