import React from 'react';
export class AdminErrorBoundary extends React.Component {
 constructor(props){super(props);this.state={failed:false};}
 static getDerivedStateFromError(){return {failed:true};}
 render(){if(!this.state.failed)return this.props.children;
 return <main className="card" role="alert" style={{margin:24,padding:24}}><h1>Не удалось открыть раздел</h1><p>Возникла ошибка интерфейса. Обновите страницу или вернитесь в главное меню.</p><button onClick={()=>window.location.reload()}>Повторить загрузку</button> <button onClick={()=>{window.location.hash='#dashboard';window.location.reload();}}>Главное меню</button></main>;
 }
}
