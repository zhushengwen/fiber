/**
 * Created by Administrator on 2015/11/8.
 */

/*
 tc:int 总任务数
 func:单个任务执行函数,func(i, callback, n),i:当前数据索引,n:当前纤程ID,callback处理完成后要回调的函数
 fc:设置纤程个数,默认是1
 done:所有任务完成后的回调函数
 */
var watchtime = 200;
var dother = 1;
var max_timeout = 3*60;
exports.ftc = function(tc,func,fc,done){
  var wtimer = 0;
  //建立任务表
  var tasks = [];
  //建立纤程
  var fibers=[];
  if(fc<=0)fc=1;
  var push_fiber = function(ri,teid,c_task){
    var fiber = {
      id:fibers.length,
      cstop:0,
      status:[],
      ctask:c_task?c_task%tasks.length:-1,
      taskse:[ri,teid],
      tcount:0,//已经执行任务数
      dother:dother,
      tmsconds:0
    };
    fibers.push(fiber);
    return fiber;
  };

  var task_fiber = function(tc,fc){
    var otc = tasks.length;
    for(var i=0;i<tc;i++)
    {
      var task = {
        status:[],
        fid:-1
      };
      tasks.push(task);
    }
    var ofc = fibers.length;
    if(fc>0){
      var ntc = tasks.length;
      var sep = Math.ceil(tc/fc);
      for(var ri= 0,i=0;ri<ntc;ri+=sep,i++)
      {
        var teid = ri+sep>ntc?ntc:ri+sep;
        push_fiber(ri,teid,ri+otc);
      }
      //添加额外的fiber
      for(;i<fc;i++)
      {
        push_fiber(otc,ntc);
      }
    }
    //唤醒所有已经睡眠的fiber
    for(var i=ofc;i<fibers.length;i++)
    {
      start_fiber(fibers[i]);
    }
    start_run();
  };
  //启动新的fiber
  //重新启动fiber
  var start_fiber = function(fiber){
    setTimeout(function (){
      if(!fiber.cstop && fiber.status.length != 1 && fiber.taskse[0] < tasks.length && func){
        //设置纤程开始时间
        fiber.status=[new Date().getTime()];
        if(fiber.ctask!=-1) fiber.ctask= fiber.taskse[0];
        console.log('Fiber' + fiber.id + ':Starting...');
        callback(fiber.id)();
      }
    },0);

  };
  task_fiber(tc,fc);

  var inc_task = function(inct,incf)
  {
    if(inct==-1)clearInterval(wtimer);
    if(inct<=0 || incf<=0)return;
    task_fiber(inct,incf);
  };
  var fiberstop = function(fiber){
    fiber.status.push(new Date().getTime());
    fiber.tmsconds += (fiber.status[1] - fiber.status[0]);
  };
  var checkfiber = function(fiber,ltask){
    var cango = true;
    //如果强制使当前纤程结束,则停止执行
    if(fiber.cstop)cango = false;

    //如果不帮助其他人完成任务,自己的结束就可以Go了
    if(!fiber.dother){
      if(ltask>=fiber.taskse[1])cango = false;
    }else{
      if(ltask>=fiber.taskse[0]+tasks.length)cango = false;
    }
    if(!cango)
    {
      console.log('Fiber' + fiber.id + ':Stoping...');
      fiberstop(fiber);
    }
    return cango;
  };
  var callback = function(fid){
    return function(e){
      if(e && e.stack)console.log(e.stack);
      var fiber = fibers[fid];
      var ltask = fiber.ctask;
      var modltask = fiber.ctask%tasks.length;
      if(modltask != -1 && tasks[modltask].fid == fid){
        //完成上次任务
        tasks[modltask].status.push(new Date().getTime());
        //找到上次任务的纤程,继续执行
        fiber.tcount++;
      }

      //继续执行下次任务
      while(true){
        if(!checkfiber(fiber,ltask))return;
        if(tasks[++ltask%tasks.length].fid==-1)break;
      }
      if(!checkfiber(fiber,ltask))return;
      var modtsk = ltask%tasks.length;
      tasks[modtsk].fid = fiber.id;
      fiber.ctask = ltask;
      tasks[modtsk].status.push(new Date().getTime());
      if(func){
        new Promise(function(resolve){
          func(modtsk,resolve,fiber.id);
        }).then(callback(fiber.id))
        .catch(callback(fiber.id));
      }
    }
  };

  //替换掉无响应的fiber
  var clear_timeout = function(){
    for(var i=0;i<fibers.length;i++)
    {
      var fiber = fibers[i];
      if(!fiber.cstop && fiber.status.length==1) {
        var task = tasks[fiber.ctask%tasks.length];
        if(task && task.status.length==1){
          var time = new Date().getTime() - task.status[0];
          if(time > max_timeout*1000)
          {
            fiber.cstop = true;
            fiberstop(fiber);
            start_fiber(push_fiber(fiber.taskse[0],fiber.taskse[1],-1));
          }
        }
      }
    }
  };
  function start_run(){
    //纤程监视
      if(!wtimer)wtimer = setInterval(function(){
      clear_timeout();
      var stop_num = 0;
      var logs = [];
      var ttasks = 0;
      for(var i=0;i<fibers.length;i++)
      {
        var fiber = fibers[i];
        var runing = fiber.status.length==1?'✔':'✘';
        if(fiber.cstop)runing = '☒';
        var time = fiber.tmsconds;
        if(fiber.status.length==1) {
          time = fiber.tmsconds + new Date().getTime() - fiber.status[0];
        }
        if(fiber.status.length!=1){
          stop_num++;
        }
        time = Math.round(time/100)/10;
        ttasks += fiber.tcount;
        logs.push('F'+i+':'+runing+'['+fiber.tcount+'T,'+time+'s]');
      }

      var ltasknum = 0;
      for(var i=0;i<tasks.length;i++)
      {
        if(tasks[i].fid == - 1)
          ++ltasknum;
      }
      if(stop_num==fibers.length) {
        if(ltasknum){
          for(var i=0;i<fibers.length;i++)
          {
            fibers[i].ctask=-1;
            start_fiber(fibers[i]);
          }

        }else if(done) {
          clearInterval(wtimer);
          wtimer = 0;
          done();
        }
      }
      var precent = tasks.length ? '['+ Math.round(100 * ttasks/tasks.length) + '%' +']':'';
      console.log('L:'+(tasks.length-ttasks) +'/'+ tasks.length + precent+'-'+logs.join(','));
    },watchtime);
  }
  return inc_task;
};