import{j as e}from"./ui-BlmhFX_F.js";import{r as p}from"./router-DFnE1L-t.js";import{c as g,x as h}from"./index-DHymdRDT.js";import{C as j}from"./redux-VN59sPcb.js";const y=({images:n,speed:t="medium",pauseOnHover:r=!0,className:c=""})=>{const[l,a]=p.useState(!1),i=n.slice(0,15),o=n.slice(15,30),m={slow:"90s",medium:"60s",fast:"40s"}[t],s=[...i,...i,...i],x=[...o,...o,...o];return e.jsxs("div",{className:`w-full overflow-hidden relative ${c}`,children:[e.jsx("div",{className:"absolute left-0 top-0 bottom-0 w-16 sm:w-32 md:w-48 bg-gradient-to-r from-white dark:from-gray-800 to-transparent z-10 pointer-events-none"}),e.jsx("div",{className:"absolute right-0 top-0 bottom-0 w-16 sm:w-32 md:w-48 bg-gradient-to-l from-white dark:from-gray-800 to-transparent z-10 pointer-events-none"}),e.jsx("div",{className:"flex mb-6 pt-2",onMouseEnter:()=>r&&a(!0),onMouseLeave:()=>r&&a(!1),children:e.jsx("div",{className:"flex gap-8 animate-marquee-ltr",style:{animationDuration:m,animationPlayState:l?"paused":"running"},children:s.map((u,f)=>e.jsx("div",{className:"flex-shrink-0",children:e.jsx("img",{src:g(u.profileImage),alt:"",className:"w-16 h-16 rounded-full object-cover shadow-lg ring-2 ring-white dark:ring-gray-700 hover:scale-110 transition-transform duration-300",loading:"lazy"})},`${u.id}-${f}`))})}),e.jsx("div",{className:"flex pb-2",onMouseEnter:()=>r&&a(!0),onMouseLeave:()=>r&&a(!1),children:e.jsx("div",{className:"flex gap-8 animate-marquee-rtl",style:{animationDuration:m,animationPlayState:l?"paused":"running"},children:x.map((u,f)=>e.jsx("div",{className:"flex-shrink-0",children:e.jsx("img",{src:g(u.profileImage),alt:"",className:"w-16 h-16 rounded-full object-cover shadow-lg ring-2 ring-white dark:ring-gray-700 hover:scale-110 transition-transform duration-300",loading:"lazy"})},`${u.id}-${f}`))})}),e.jsx("style",{children:`
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
      `})]})},v=h.injectEndpoints({endpoints:n=>({getMarqueeProfiles:n.query({query:()=>"/demo/marquee-profiles?v=3",transformResponse:t=>t.data,keepUnusedDataFor:604800})}),overrideExisting:!1}),{useGetMarqueeProfilesQuery:w}=v,k=({speed:n="medium",className:t=""})=>{const{data:r,isLoading:c,error:l}=w(),{user:a}=j(o=>o.auth),i=p.useMemo(()=>{if(!r||r.length===0)return[];if(!a?.id||!a?.profileImage||r.some(s=>s.id===a.id))return r;const d=[...r];let m=-1;for(let s=d.length-1;s>=0;s--)if(d[s].type==="dummy"){m=s;break}return m!==-1&&(d[m]={id:a.id,type:"real",profileImage:`/api/users/profile-picture/${a.id}`}),d},[r,a]);return c?e.jsx("div",{className:`w-full py-8 ${t}`,children:e.jsxs("div",{className:"flex justify-center items-center",children:[e.jsx("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"}),e.jsx("span",{className:"ml-3 text-gray-600 dark:text-gray-400",children:"Loading alumni..."})]})}):(l&&console.error("Marquee error:",l),!i||i.length===0?l?e.jsx("div",{className:`w-full py-4 ${t}`,children:e.jsx("div",{className:"flex justify-center items-center text-gray-400 dark:text-gray-600 text-sm",children:e.jsx("span",{children:"Loading alumni profiles..."})})}):null:e.jsx("div",{className:t,children:e.jsx(y,{images:i,speed:n})}))};export{k as P};
//# sourceMappingURL=ProfileMarquee-D9BUWcEs.js.map
