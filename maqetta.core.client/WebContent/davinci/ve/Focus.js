define([
	"require",
	"dojo/_base/declare",
	"dijit/_WidgetBase",
	"dojo/dnd/Mover",
	"./metadata"
],
function(require, declare, _WidgetBase, Mover, Metadata) {
	
// Nobs
	var LEFT = 0,
	RIGHT = 1,
	TOP = 2,
	BOTTOM = 3,
	LEFT_TOP = 4,
	LEFT_BOTTOM = 5,
	RIGHT_TOP = 6,
	RIGHT_BOTTOM = 7;
// Sides
var LEFT = 0,
	RIGHT = 1,
	TOP = 2,
	BOTTOM = 3;

return declare("davinci.ve.Focus", _WidgetBase, {

	// Inside knowledge about CSS classes used to style editFocusNob and editFocusFrame DIVs
	nobSize:11,
	frameSize:6,

	postCreate: function(){
		dojo.addClass(this.domNode, 'maqFocus');
		dojo.style(this.domNode, {position: "absolute", display: "none"}); // FIXME: use CSS class to change display property
		this._stdChrome = dojo.create("div", {"class": "editFocusStdChrome"}, this.domNode);
		
		this._frames = [];
		for(var i = 0; i < 4; i++){
			var frame = dojo.create("div", {"class": "editFocusFrame"}, this._stdChrome);
			this._frames.push(frame);
			this.connect(frame, "onmousedown", "onMouseDown");
			this.connect(frame, "onmouseup", "onMouseUp");
			this.connect(frame, "ondblclick", "onDblClick");
		}
		dojo.addClass(this._frames[LEFT], "editFocusFrameLEFT");
		dojo.addClass(this._frames[RIGHT], "editFocusFrameRIGHT");
		dojo.addClass(this._frames[TOP], "editFocusFrameTOP");
		dojo.addClass(this._frames[BOTTOM], "editFocusFrameBOTTOM");
		
		this._nobs = [];
		var cursors = ["w-resize","e-resize","n-resize","s-resize","nw-resize", "sw-resize", "ne-resize", "se-resize"];
		var border = (dojo.isIE ? 0 : 2);
		for(var i = 0; i < 8; i++){
			var nob = dojo.create("div", {"class": "editFocusNob", style: {
				cursor: cursors[i]
			}}, this._stdChrome);
			this._nobs.push(nob);
			this.connect(nob, "onmousedown", "onMouseDown");
			this.connect(nob, "onmouseup", "onMouseUp");
		}
		this._nobIndex = -1;
		this._frameIndex = -1;
		
		this._custom = dojo.create("div", {"class": "editFocusCustom"}, this.domNode);
		
		// _box holds resize values during dragging assuming no shift-key constraints
		// _constrained holds resize values after taking into account shift-key constraints
		this._box = {l: 0, t: 0, w: 0, h: 0};
		this._constrained = dojo.mixin({}, this._box);
		
		this._resizable = {width: true, height: true};
	},

	resize: function(box, widget){
//console.log('resize. box=');
//console.dir(box);
//console.trace();
		if(widget){
		    this._selectedWidget = widget;
		}
		this._moverCurrent = { focusLeft:box.l, focusTop:box.t, focusWidth:box.w, focusHeight:box.h };
		var offScreenAdjust = true;
		this._updateFromCurrent(offScreenAdjust);
//console.log('resize. setting this._box = box');
    	this._box = box;
//console.log('resize exit. this._box=');
//console.dir(this._box);
	},

	show: function(widget, inline){
		//debugger;
		if (!widget){
			// sometimes you get no widget when  DnD in split screen
			return; 
		}
		this._custom.innerHTML = '';
		var showStandardSelectionChrome = Metadata.queryDescriptor(widget.type, "showStandardSelectionChrome");
		this._stdChrome.style.display = (showStandardSelectionChrome === false) ? 'none' : 'block';
		this.domNode.style.display = "block";
		this._selectedWidget = widget;
		var helper = widget.getHelper();
		var delete_inline = true;
		if(helper && helper.onShowSelection){
			helper.onShowSelection({widget:widget, customDiv:this._custom,
				bboxActual:this._bboxActual, bboxAdjusted:this._bboxAdjusted});
		}
		if (inline) {
			this.showInline(widget); // sometimes the widget changes from undo/redo som get the current widget
			delete_inline = false;
		}
		if(delete_inline){
			delete this._inline; // delete any old inline kicking around
		}
    },

	showInline: function(widget) {
		this._selectedWidget = widget;
		var context = this._context;
		var self = this;
		Metadata.getSmartInput(widget.type).then(function(inline) {
			if(!inline){
				return;
			}
			self._inline = inline;
			if (inline.useParent) {
				var parentWidget = widget.getParent();
				if (parentWidget) {
					context.deselect(widget);
					context.select(parentWidget);
					var parentFocusObject = context.getFocus(parentWidget);
					parentFocusObject.showInline(parentWidget);
				}
			} else if (inline.show) {
				inline.show(widget.id);
			}
		});
	},

	inlineEditActive: function(){
		if(this._inline && this._inline.inlineEditActive){
			return this._inline.inlineEditActive();
		}else{
			return false;
		}
		
	},

	hide: function(inline){

		var widget = this._selectedWidget;
		var helper = widget ? widget.getHelper() : undefined;
		if(helper && helper.onHideSelection){
			// Don't know if any widgets actually use this helper
			// Included for completeness
			helper.onHideSelection({widget:widget, customDiv:this._custom});
		}
		this.domNode.style.display = "none";
		this._selectedWidget = null;	// Used by page editor
		this._displayedWidget = null;	// Used by theme editor
		if (this._inline){
			this._inline.hide();
			delete this._inline;
		}
	},

    allow: function(op){
        if(!op){
            return;
        }
        this._op = op;

        var horizontal = (op.resizeWidth && !op.resizeHeight) ? "block" : "none";
        var vertical = (op.resizeHeigh && !op.resizeWidth) ? "block" : "none";
        var corner = (op.resizeWidth && op.resizeHeight) ? "block" : "none";
        this._nobs[LEFT].style.display = horizontal;
        this._nobs[RIGHT].style.display = horizontal;
        this._nobs[TOP].style.display = vertical;
        this._nobs[BOTTOM].style.display = vertical;
        this._nobs[LEFT_TOP].style.display = corner;
        this._nobs[LEFT_BOTTOM].style.display = corner;
        this._nobs[RIGHT_TOP].style.display = corner;
        this._nobs[RIGHT_BOTTOM].style.display = corner;
    },
	
	onMouseDown: function(event){
console.log('onMouseDown entered.');
//console.dir(this._box);
		this._removeKeyHandlers();

		if(!this._selectedWidget || !this._selectedWidget.domNode){
			return;
		}
		// not to start Mover on the context menu
		if(event.button === 2 || event.ctrlKey){
			return;
		}
		// Only process mousedown events when SelectTool is active
		// Mostly to allow CreateTool to drag out widget initial size even
		// when mouse is over focus nodes
		if(this._context._activeTool.declaredClass != 'davinci.ve.tools.SelectTool'){
			return;
		}
		this._shiftKey = false;

		this._nobIndex = dojo.indexOf(this._nobs, event.target);
		this._frameIndex = dojo.indexOf(this._frames, event.target);

		var moverDragDivSize = 100;
		var moverDragDivHalf = 50;
		var l = event.pageX - moverDragDivHalf;
		var t = event.pageY - moverDragDivHalf;
		var node = this._selectedWidget.domNode;
		this._moverStart = { moverLeft:l, moverTop:t,
				focusLeft:parseInt(this.domNode.style.left), focusTop:parseInt(this.domNode.style.top),
				focusWidth:node.offsetWidth, focusHeight:node.offsetHeight };
		this._moverCurrent = dojo.mixin({}, this._moverStart);
		this._moverDragDiv = dojo.create('div', 
				{style:'position:absolute;z-index:2000000;background:transparent;left:'+l+'px;top:'+t+'px;width:'+moverDragDivSize+'px;height:'+moverDragDivSize+'px'},
				this._context.rootNode);
		this._mover = new Mover(this._moverDragDiv, event, this);
		dojo.stopEvent(event);

		var userdoc = this._context.getDocument();	// inner document = user's document
		userdoc.defaultView.focus();	// Make sure the userdoc is the focus object for keyboard events
		this._keyDownHandler = dojo.connect(userdoc, "onkeydown", dojo.hitch(this, function(e){
			this.onKeyDown(e);
		}));
		this._keyUpHandler = dojo.connect(userdoc, "onkeyup", dojo.hitch(this, function(e){
			this.onKeyUp(e);
		}));
     },

    onMouseUp: function(event){
//console.log('onMouseUp entered');
        var context = this._context;
		var cp = context._chooseParent;
		this._lastEventTarget = null;
		this._removeKeyHandlers();
        if(this._mover){
        	var box;
        	if(this._shiftKey){
        		box = dojo.mixin({}, this._constrained);
        	}else{
//console.log('onMouseUp. setting box mixin this._box');
        		box = dojo.mixin({}, this._box);
        	}
            this._mover = undefined;
            this.onExtentChange(this, box);
        }
		context.dragMoveCleanup();
     	cp.parentListDivDelete();
        this._nobIndex = -1;
        this._frameIndex = -1;
    },
    
    onDblClick: function(event) {
        this.showInline(this._selectedWidget);
        event.stopPropagation();
    },

	_updateFromCurrent: function(offScreenAdjust){
		var c = this._moverCurrent;
		
		// Various constants leveraging knowledge about selection chrome CSS style rules
		var nobOffScreenAdjust = this.nobSize + 1;
		var frameOffScreenAdjust = this.frameSize + 1;
		var normalFrameLeft = -6;
		var normalFrameTop = -6;
		var normalNobLeft = -11;
		var normalNobTop = -11;
		
		this.domNode.style.left = c.focusLeft + 'px';
		this.domNode.style.top = c.focusTop + 'px';
		
		var nobOffScreenAdjustLeft = 0, nobOffScreenAdjustTop = 0, nobOffScreenAdjustWidth = 0, nobOffScreenAdjustHeight = 0;
		var frameOffScreenAdjustLeft = 0, frameOffScreenAdjustTop = 0, frameOffScreenAdjustWidth = 0, frameOffScreenAdjustHeight = 0;
		var nobLeftsideAdjustedLeft = normalNobLeft;
		var nobTopsideAdjustedTop = normalNobTop;
		var nobWidthAdjusted = c.focusWidth;
		var nobHeightAdjusted = c.focusHeight;
		var nobRightsideAdjustedLeft = c.focusWidth;
		var nobBottomsideAdjustedTop = c.focusHeight;
		var frameLeftsideLeftAdjusted = normalFrameLeft;
		var frameTopsideTopAdjusted = normalFrameTop;
		var frameWidthAdjusted = c.focusWidth;
		var frameHeightAdjusted = c.focusHeight;
		var frameRightsideAdjustedLeft = c.focusWidth;
		var frameBottomsideAdjustedTop = c.focusHeight;
		if(offScreenAdjust){
			// Determine if parts of selection are off screen
			// Shift selection to make it visible
			var farthestLest, farthestTop, farthestRight, farthestBottom;
			var bodyWidth = this.domNode.ownerDocument.body.offsetWidth;
			var bodyHeight = this.domNode.ownerDocument.body.offsetHeight;
			farthestLeft = c.focusLeft - nobOffScreenAdjust;
			farthestTop = c.focusTop - nobOffScreenAdjust;
			nobOffScreenAdjustLeft = farthestLeft < 0 ? -farthestLeft : 0;
			nobOffScreenAdjustTop = farthestTop < 0 ? -farthestTop : 0;
			nobLeftsideAdjustedLeft += nobOffScreenAdjustLeft;
			nobTopsideAdjustedTop += nobOffScreenAdjustTop;
			farthestRight = c.focusLeft + c.focusWidth + nobOffScreenAdjust;
			farthestBottom = c.focusTop + c.focusHeight + nobOffScreenAdjust;
			nobRightsideAdjustedLeft += (farthestRight > bodyWidth ? bodyWidth - farthestRight : 0);	
			nobBottomsideAdjustedTop += (farthestBottom > bodyHeight ? bodyHeight - farthestBottom : 0);

			farthestLeft = c.focusLeft - frameOffScreenAdjust;
			farthestTop = c.focusTop - frameOffScreenAdjust;
			frameOffScreenAdjustLeft = farthestLeft < 0 ? -farthestLeft : 0;
			frameOffScreenAdjustTop = farthestTop < 0 ? -farthestTop : 0;
			frameLeftsideLeftAdjusted += frameOffScreenAdjustLeft;
			frameTopsideTopAdjusted += frameOffScreenAdjustLeft;
			farthestRight = c.focusLeft + c.focusWidth + frameOffScreenAdjust;
			farthestBottom = c.focusTop + c.focusHeight + frameOffScreenAdjust;
			frameRightsideAdjustedLeft += (farthestRight > bodyWidth ? bodyWidth - farthestRight : 0);	
			frameBottomsideAdjustedTop += (farthestBottom > bodyHeight ? bodyHeight - farthestBottom : 0);
			frameOffScreenAdjustWidth = farthestRight > bodyWidth ? (bodyWidth - farthestRight) : 0;	// will be zero or negative
			frameOffScreenAdjustHeight = farthestBottom > bodyHeight ? (bodyHeight - farthestBottom) : 0;	// will be zero or negative
		}
		var nobWidthAdjusted = c.focusWidth + nobOffScreenAdjustWidth - nobOffScreenAdjustLeft;
		var nobHeightAdjusted = c.focusHeight + nobOffScreenAdjustHeight - nobOffScreenAdjustTop;
		var frameWidthAdjusted = c.focusWidth + frameOffScreenAdjustWidth - frameOffScreenAdjustLeft;
		var frameHeightAdjusted = c.focusHeight + frameOffScreenAdjustHeight - frameOffScreenAdjustTop;
		
		// Adjustment factors requiring inside knowledge of CSS rules on editFocusNob and editFocusFrame
		var frameSizeAdjust = 8;
		var frameWidth = frameWidthAdjusted + frameSizeAdjust;
		var frameHeight = frameHeightAdjusted + frameSizeAdjust;
		this._frames[LEFT].style.left =
			this._frames[TOP].style.left =
			this._frames[BOTTOM].style.left = frameLeftsideLeftAdjusted + "px";
		this._frames[LEFT].style.top =
			this._frames[TOP].style.top =
			this._frames[RIGHT].style.top = frameTopsideTopAdjusted + "px";
		this._frames[LEFT].style.height = frameHeight + "px";
		this._frames[RIGHT].style.height = frameHeight + "px";
		this._frames[RIGHT].style.left = frameRightsideAdjustedLeft + "px";
		this._frames[TOP].style.width = frameWidth + "px";
		this._frames[BOTTOM].style.top = frameBottomsideAdjustedTop + "px";
		this._frames[BOTTOM].style.width = frameWidth + "px";

		// Adjustment factors requiring inside knowledge of CSS rules on editFocusNob and editFocusFrame
		var nobLocationAdjust = -1;
		var l = Math.round(nobWidthAdjusted / 2 - this.nobSize / 2);
		var t = Math.round(nobHeightAdjusted / 2 - this.nobSize / 2);
		this._nobs[LEFT].style.left =
			this._nobs[LEFT_TOP].style.left =
			this._nobs[LEFT_BOTTOM].style.left = nobLeftsideAdjustedLeft + "px";
		this._nobs[TOP].style.top =
			this._nobs[LEFT_TOP].style.top =
			this._nobs[RIGHT_TOP].style.top = nobTopsideAdjustedTop + "px";
		this._nobs[LEFT].style.top = t + "px";
		this._nobs[RIGHT].style.left = nobRightsideAdjustedLeft + "px";
		this._nobs[RIGHT].style.top = t + "px";
		this._nobs[TOP].style.left = l + "px";
		this._nobs[BOTTOM].style.left = l + "px";
		this._nobs[BOTTOM].style.top = nobBottomsideAdjustedTop + "px";
		this._nobs[LEFT_BOTTOM].style.top = nobBottomsideAdjustedTop + "px";
		this._nobs[RIGHT_TOP].style.left = nobRightsideAdjustedLeft + "px";
		this._nobs[RIGHT_BOTTOM].style.left = nobRightsideAdjustedLeft + "px";
		this._nobs[RIGHT_BOTTOM].style.top = nobBottomsideAdjustedTop + "px";
	},

    onMove: function(mover, box, event){
//console.log('onMove. box.l='+box.l+',box.t='+box.t);
//console.log('this._box=');
//console.dir(this._box);
    	if(this._moverDragDiv){
    		this._moverDragDiv.style.left = box.l + 'px';
    		this._moverDragDiv.style.top = box.t + 'px';
    	}
		var start = this._moverStart;
		var dx = box.l - start.moverLeft;
		var dy = box.t - start.moverTop;
		if(this._frameIndex === LEFT || this._nobIndex === LEFT_TOP || this._nobIndex === LEFT || this._nobIndex === LEFT_BOTTOM){
			this._moverCurrent.focusLeft = start.focusLeft + dx;
			this._moverCurrent.focusWidth = start.focusWidth - dx;
		}else if(this._frameIndex === RIGHT || this._nobIndex === RIGHT_TOP || this._nobIndex === RIGHT || this._nobIndex === RIGHT_BOTTOM){
			this._moverCurrent.focusWidth = start.focusWidth + dx;
		}
		if(this._frameIndex === TOP || this._nobIndex === LEFT_TOP || this._nobIndex === TOP || this._nobIndex === RIGHT_TOP){
			this._moverCurrent.focusTop = start.focusTop + dy;
			this._moverCurrent.focusHeight = start.focusHeight - dy;
		}else if(this._frameIndex === BOTTOM || this._nobIndex === LEFT_BOTTOM || this._nobIndex === BOTTOM || this._nobIndex === RIGHT_BOTTOM){
			this._moverCurrent.focusHeight = start.focusHeight + dy;
		}
		var offScreenAdjust = false;
		this._updateFromCurrent(offScreenAdjust);

    },

    onFirstMove: function(mover){
        this._mover = mover;
    },

    //Required for Moveable interface 
    onMoveStart: function(mover){
    },

 	onMoveStop: function(mover){
//console.log('onMoveStop');
		if(this._moverDragDiv){
			var parentNode = this._moverDragDiv.parentNode;
			if(parentNode){
				parentNode.removeChild(this._moverDragDiv);
			}
			this._moverDragDiv = null;
			this.onExtentChange(this, 
					{l:this._moverCurrent.focusLeft, t:this._moverCurrent.focusTop, 
					w:this._moverCurrent.focusWidth, h:this._moverCurrent.focusHeight});
		}
 	},
    
    onKeyDown: function(event){
		if(event){
	    	dojo.stopEvent(event);
	    	if(event.keyCode == 16){
	        	this._shiftKey = true;
	        	this._resize(this._constrained);   		
	    	}
		}else{
			// If event is undefined, something is wrong - remove the key handlers
			this._removeKeyHandlers();
		}
    },
    
    onKeyUp: function(event){
		if(event){
	    	dojo.stopEvent(event);
	    	if(event.keyCode == 16){
		    	this._shiftKey = false;
		       	this._resize(this._box);
	    	}
		}else{
			// If event is undefined, something is wrong - remove the key handlers
			this._removeKeyHandlers();
		}
    },
    
    _removeKeyHandlers: function(){
		if(this._keyDownHandler){
			dojo.disconnect(this._keyDownHandler);
			this._keyDownHandler = null;
		}
		if(this._keyUpHandler){
			dojo.disconnect(this._keyUpHandler);
			this._keyUpHandler = null;
		}
    },

    onExtentChange: function(focus, box){
    },
    
    showContext: function(context, widget){
        if(!this._contexDiv){
            this._context = context;
            //this._selectedWidget = null;
            this._createContextPopUp();
        }
        this._contexDiv.style.display = "block";
    },
    
    hideContext: function(){
        if(this._contexDiv){
            this._contexDiv.style.display = "none";
        }
    },
    
    _createContextPopUp: function(){
        
        var contexDiv= dojo.doc.createElement("div");
        contexDiv.id = 'ieb';
        this._contexDiv = contexDiv;
        this.domNode.appendChild(contexDiv);

    },
    //FIXME: should this code be delegated to themeEditor somehow? This was moved here for future use by the page editor. 
    // If the page editor every supports styling supwidgets...
    _createSubwidgetList: function() {
        //if(this._cm)return;
        var widget = this._context._selectedWidget;
        if (!widget) {
        	return;
        }
        var themeMetadata = this._context.getThemeMeta().metadata;
        var widgetType = themeMetadata.getWidgetType(widget);
        var widgetMetadata = themeMetadata.getMetadata(widgetType);
        var subwidgets = widgetMetadata.subwidgets;
        
        this._displayedWidget = widget;
        if(subwidgets){
            var contexDiv=this._contexDiv;
            contexDiv.innerHTML = '<span></span>';
            contexDiv.style.position = "absolute";
            var x = this._box.w + 10;
            contexDiv.style.left = x + 'px';
            contexDiv.className = "themeSubwidgetMenu";
            dojo.connect(contexDiv, "onmousedown", this, "stopPropagation");
            contexDiv.style.display = "none";
            this._contexDiv = contexDiv;
            this.domNode.appendChild(contexDiv);
            var span = this._contexDiv.firstElementChild,
                menuId = this._context._themeName + '_subwidgetmenu',
                pMenu = dijit.byId(menuId);
            if (pMenu) {
                pMenu.destroyRecursive(false);
            }
            // get the version of dijit that the theme editor html template is using.
            // if we don't when we create the subwidget menu dojo/resources/blank.gif can't be found 
            // and we have no check boxes on FF
            var localDijit = this._context.getDijit();
            pMenu = new localDijit.Menu({id:menuId}, span);
            var checked = false;
            if (!widget.subwidget) {
                checked = true; // no subwidget selected
            }
            var item = new localDijit.CheckedMenuItem({
                label: 'WidgetOuterContainer',
                id: this._context._themeName + '_WidgetOuterContainer',
                checked: checked,
                onClick: dojo.hitch(this, "_subwidgetSelected")
            });
            pMenu.addChild(item);
            this._currentItem = item;
            for (var s in subwidgets){
                checked = (widget.subwidget === s);
                var menuItem = new localDijit.CheckedMenuItem({
                    label: s,
                    id: this._context._themeName + '_' + s,
                    checked: checked,
                    onClick: dojo.hitch(this, "_subwidgetSelected")
                });
                pMenu.addChild(menuItem);
                if (checked) {
                    this._currentItem = menuItem;
                }
            }
            pMenu.startup();
            this._cm = pMenu;
            this._updateSubwidgetListForState();
            this._connections = [];
            this._connections.push(dojo.subscribe("/davinci/ui/subwidgetSelectionChanged",dojo.hitch(this,this._subwidgetSelectedChange)));
            this._connections.push(dojo.subscribe("/davinci/states/state/changed", dojo.hitch(this, this._updateSubwidgetListForState)));
        }

    },

    stopPropagation: function(e){
        e.stopPropagation();
    },
    
    _subwidgetSelected: function(e){
        e.stopPropagation();
        var localDijit = this._context.getDijit();
        var item = localDijit.byId(e.currentTarget.id);
        //var item = dijit.byId(e.currentTarget.id);
        var subwidget;
        if (item.checked){
            if (this._currentItem && item != this._currentItem) {
                this._currentItem.set("checked", false);
            }
            this._currentItem = item;
            subwidget = this._currentItem.label;
        } else {
            //this._currentItem = dijit.byId(this._context._themeName + '_WidgetOuterContainer');
            this._currentItem = localDijit.byId(this._context._themeName + '_WidgetOuterContainer');
            if (this._currentItem) {
                this._currentItem.set("checked", true);
            }
            subwidget = null;
        }
        if (e.currentTarget.id === (this._context._themeName + '_WidgetOuterContainer')){
            subwidget = null;
        }
        dojo.publish("/davinci/ui/subwidgetSelectionChanged",[{subwidget: subwidget, origin: this.declaredClass}]);
            
       
    },
    
    _subwidgetSelectedChange: function(e){

        var localDijit = this._context.getDijit();
        if (e.origin ===  this.declaredClass){
            // must be our own message
            return;
        } else {
            if (this._currentItem) {
                this._currentItem.set("checked", false); // unset the one we have
            }
            if (e.subwidget){
                this._currentItem = localDijit.byId(this._context._themeName + '_' + e.subwidget);
                if (this._currentItem) {
                    this._currentItem.set("checked", true);
                }
            } else{
                this._currentItem = localDijit.byId(this._context._themeName + '_WidgetOuterContainer');
                if (this._currentItem) {
                    this._currentItem.set("checked", true);
                }
                //this._currentItem = null;
            }
        }
    },
    
    
    _updateSubwidgetListForState: function() {
        if (this._context._selectedWidget && this._displayedWidget === this._context._selectedWidget) {
            var editor = davinci.Runtime.currentEditor,
                themeMetadata = editor._theme;
            this._cm.getChildren().forEach(function(child) {
                var subwidget = child.label;
                if (subwidget === 'WidgetOuterContainer') {
                    subwidget = null;
                }
                child.setDisabled(
                    !themeMetadata.isStateValid(
                        this._displayedWidget,
                        editor._currentState,
                        subwidget));
            }, this);
        } else {
            this._clearList();
            this._createSubwidgetList();
        }
    },
    
    _updateSubwidgetList: function() {
        if (this._displayedWidget === this._context._selectedWidget) { return; } // we are already displaying the subwidgets
        this._clearList();
        this._createSubwidgetList();
    },
    
    _clearList: function() {
        if (this._cm){
            this._cm.destroyRecursive(false);
            delete this._cm;
            while (connection = this._connections.pop()){
                dojo.unsubscribe(connection);
            }
        }
        this._currentItem = null;
    },
    
    // FIXME: Temporary hack just before M5 release
    // Front-end to dojo.style that prevents possible reference through undefined
    dojoStyle: function(node, name, value){
    	if(node && node.ownerDocument && node.ownerDocument.defaultView){
    		var win = node.ownerDocument.defaultView;
    		var cs = win.getComputedStyle(node);
    		if(cs){
    			return dojo.style.apply(dojo, arguments);
    		}
    	}
    }
});

});
