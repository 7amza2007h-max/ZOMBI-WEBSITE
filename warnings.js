'use strict';
const w=require('./public/warningSystem');
module.exports={handleWarningMessage:w.handleMessage,handleRemoveWarningMessage:async()=>false,handleWarningButton:async i=>i.isButton()?w.handleInteraction(i):false,handleWarningModal:async i=>i.isModalSubmit()?w.handleInteraction(i):false};
