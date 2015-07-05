var RETRO_CATEGORIES = [{key:'GOOD',display:'THE GOOD'}, {key:'BAD',display:'THE BAD'}, {key: 'IDEAS',display:'THE IDEAS'}, {key: 'ACCLAIM', display:'THE ACCLAIM'}];

Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    padding: 10,
    items: [      // pre-define the general layout of the app; the skeleton (ie. header, content, footer)
      {
        xtype: 'container', // this container lets us control the layout of the pulldowns; they'll be added below
        itemId: 'pulldown-container',
        layout: {
          type: 'hbox',           // 'horizontal' layout
          align: 'stretch'
        }
      },
      {
        xtype: 'container', // this container is for the controls related to item submission
        itemId: 'add-new-container',
        layout: {
          align: 'bottom',
          type: 'hbox'
        },
        border: 0
      },
      {
        xtype: 'container', // this container is for the controls related to item submission
        itemId: 'item-panel-container',
        layout: {
          type: 'vbox',
          align: 'stretch'
        }
      }
    ],
    itemId:'retroApp',
    iterationStore: undefined,       // app level references to the store and grid for easy access in various methods
    retroItemsPanel: undefined,

    // Entry Point to App
    launch: function() {
      var me = this;                     // convention to hold a reference to the 'app' itself; reduce confusion of 'this' all over the place; when you see 'me' it means the 'app'
      // console.log('our second app');     // see console api: https://developers.google.com/chrome-developer-tools/docs/console-api
      me._renderSubmissionField();
      me._loadIterations();
    },

// Rendering -----------------------------------------------------------------------------------------------------------------------------------------
    _renderSubmissionField: function() {
      try {
        var me = this;
        var itemDescription = '';
        var button = Ext.create('Rally.ui.Button', {
          itemId: 'add-new-submit-button',
          text: 'Add',
          handler: me._handleSubmitClick,
          disabled: true,
          margin: 5,
          flex: 1
        });
        var textInput = Ext.create('Rally.ui.TextField', {
          itemId: 'add-new-text-box',
          emptyText: 'Enter a short description of your retro item',
          fieldLabel: 'ADD NEW RETRO ITEM',
          labelSeparator: '',
          flex: 8,
          height: 40,
          labelAlign: 'top',
          margin: 5,

          listeners: {
            change: function(cmp, newContent) {
              if (_.isEmpty(newContent)) {
                button.disable();
              } else {
                button.enable();
              }
            },
            specialkey: function(field, e) {
              if (e.getKey() === e.ENTER &&
                  !button.isDisabled()) {
                me._handleSubmitClick(button);
              }
            }
          }
        });
        var checkbox = Ext.create('Rally.ui.CheckboxField', {
          itemId: 'add-new-anonymous-check-box',
          fieldLabel: 'Anonymous',
          labelSeparator: '',
          value: true,
          flex: 1,
          labelAlign: 'right',
          margin: 5
        });
        var category = Ext.create('Rally.ui.combobox.ComboBox', {
          itemId: 'add-new-combo-box',
          fieldLabel: 'CATEGORY',
          flex: 1,
          labelAlign: 'top',
          margin: 5,

          store: _.pluck(RETRO_CATEGORIES, 'key')
        });

        me.down('#add-new-container').add(textInput);
        me.down('#add-new-container').add(category);
        me.down('#add-new-container').add(checkbox);
        me.down('#add-new-container').add(button);
      } catch (e) {
        console.log(e);
      }
    },
    _renderRetroItems: function(){
      var me = this;
      // console.log(me);
      // Ensure default retro categories exist
      me._addDefaultRetroCategoryPanels();
      // Find existing rendered items
      var existingRetroItemContainers = [];
      if(me.down('#item-panel').items){
        _.forEach(me.down('#item-panel').items.items, function(categoryPanel){
          // console.log("categoryPanel?", categoryPanel);
          if(categoryPanel.items){
            _.forEach(categoryPanel.items.items, function(retroItemContainer){
              if(!me._getRetroItemRef(retroItemContainer.retroItem)){
                existingRetroItemContainers.push(retroItemContainer);
              }
            }, me);
          }
        }, me);
      }
      // Delete rendered items that no longer exist in the retro item array
      _.forEach(existingRetroItemContainers, function(retroItemContainer){
        me._deleteRetroItemContainer(retroItemContainer.retroItem);
      });
      // Update and add all items defined in the retro item array
      _.forEach(me.retroItemsArray, function(retroItem){
        var retroItemContainerRef = me._getRetroItemContainerRef(retroItem);
        if(retroItemContainerRef){
          me._updateRetroItemContainer(retroItem);
        } else {
          me._addRetroItemContainer(retroItem);
        }
      });
    },

    // create and load iteration pulldown
    _loadIterations: function() {
        var me = this;
        var iterComboBox = Ext.create('Rally.ui.combobox.IterationComboBox', {
          itemId: 'iteration-combobox',     // we'll use this item ID later to get the users' selection
          fieldLabel: 'Retroapptive for iteration',
          labelCls:'x-panel-header-text-container-default',
          labelAlign: 'left',

          labelWidth: 300,
          width: 600,
          listeners: {
            ready: me._loadData,      // initialization flow: next, load severities
            select: me._loadData,           // user interactivity: when they choose a value, (re)load the data
            scope: me
        }
        });

        this.down('#pulldown-container').add(iterComboBox);  // add the iteration list to the pulldown container so it lays out horiz, not the app!
    },


    // construct filters for defects with given iteration (ref) value
    _getFilters: function(iterationValue) {

      var iterationFilter = Ext.create('Rally.data.wsapi.Filter', {
              property: 'ObjectID',
              operation: '=',
              value: iterationValue
      });

      return iterationFilter;
    },

    // Get data from Rally
    _loadData: function() {

      var me = this;
      var selectedIterRef = this.down('#iteration-combobox').getRecord().get('ObjectID');              // the _ref is unique, unlike the iteration name that can change; lets query on it instead!
      var myFilters = this._getFilters(selectedIterRef);

      // console.log('Iteration Filter:', myFilters.toString());

      // if store exists, just load new data
      if (me.iterationStore) {
        // console.log('store exists');
        me.iterationStore.setFilter(myFilters);
        me.iterationStore.load();

      // create store
      } else {
        // console.log('creating store');
        me.iterationStore = Ext.create('Rally.data.wsapi.Store', {     // create iterationStore on the App (via this) so the code above can test for it's existence!
          model: 'Iteration',
          autoLoad: true,                         // <----- Don't forget to set this to true! heh
          filters: myFilters,
          listeners: {
              load: function(myStore, myData, success) {
                // console.log(success, myStore, myData);
                me._readRetroItems();
                me._renderRetroItems();
                // if (!me.retroItemsPanel) {           // only create a grid if it does NOT already exist
                //   me._createGrid(myStore);      // if we did NOT pass scope:this below, this line would be incorrectly trying to call _createGrid() on the store which does not exist.
                // }
              },
              scope: me                         // This tells the wsapi data store to forward pass along the app-level context into ALL listener functions
          },
          fetch: ['FormattedID', 'Name', 'Notes']   // Look in the WSAPI docs online to see all fields available!
        });
      }
    },

    // _updateData: function() {
    //   try {
    //     var me = this;
    //     var resultStr = JSON.stringify(me.retroItems);
    //     me.iterationStore.data.items[0].set('Notes', resultStr)
    //     me.iterationStore.data.items[0].save();
    //     // TODO: make a new '_updateAccordionItems' function that does not re-create the elements
    //     // but instead only updates the dynamic data in the elements (vote disable/enable, vote count) and removes deleted elements
    //     if(!me.down('#item-panel')) {
    //       me._createAccordionPanel();
    //     }
    //     // console.log('Commited Changes to current Rally Iteration', me.retroItems);
    //   } catch(e) {
    //     console.log(e);
    //   }
    // },

// RetroItems ------------------------------------------------------------------------------------------------------------------------------------
    _readRetroItems: function(){
      var me = this;
      me.retroItemsArray = [];
      try {
        if(me.iterationStore){
          var iterationNotes = me.iterationStore.data.items[0].data.Notes;
          if (iterationNotes) {
            me.retroItemsArray = JSON.parse(iterationNotes);
            _.sortBy(me.retroItemsArray, 'timestamp');
          }
        }
      } catch (e) {
        console.log(e);
      }
    },
    _addRetroItem: function(retroItem){
      var me = this;
      me._readRetroItems();
      var insertionIndex = _.sortedIndex(me.retroItemsArray, retroItem, 'timestamp');
      me.retroItemsArray.splice(insertionIndex,0,retroItem);
      me._writeRetroItems();
    },
    _updateRetroItem: function(retroItem){
      var me = this;
      me._readRetroItems();
      var retroItemRef = me._getRetroItemRef(retroItem);
      if(retroItemRef){
        var insertionIndex = _.indexOf(me.retroItemsArray, retroItemRef);
        _.remove(me.retroItemsArray, retroItemRef);
        me.retroItemsArray.splice(insertionIndex,0,retroItem);
        me._writeRetroItems();
      }
    },
    _deleteRetroItem: function(retroItem){
      var me = this;
      me._readRetroItems();
      // find the newly updated retroItem in the retroItemsArray
      var retroItemRef = me._getRetroItemRef(retroItem);
      if(retroItemRef){
        _.remove(me.retroItemsArray, retroItemRef);
        me._writeRetroItems();
      }
    },
    _getRetroItemRef: function(retroItem){
      var me = this;
      me._readRetroItems();
      var retroItemRef = _.find(me.retroItemsArray, function(_retroItem){return _.isEqual(_retroItem.id, retroItem.id);});
      // if(!retroItemRef){
      //   retroItemRef = _addRetroItem(retroItem);
      // }
      return retroItemRef;
    },
    _writeRetroItems: function(){
      try {
        var me = this;
        var resultStr = JSON.stringify(me.retroItemsArray);
        me.iterationStore.data.items[0].set('Notes', resultStr)
        me.iterationStore.data.items[0].save();
        // console.log('Commited Changes to current Rally Iteration', me.retroItemsArray);
      } catch(e) {
        console.log(e);
      }
    },
// RetroItem UI ----------------------------------------------------------------------------------------------------------------------------------
    // adds a retro item panel to the app if it doesn't already exist
    // returns a reverence to the panel
    _addRetroItemsPanel: function(){
      var me = this;
      var retroItemsPanel = me.down('#item-panel');
      try {
        // create panel if it doesn't exist
        if(!retroItemsPanel){
            retroItemsPanel = Ext.create('Ext.panel.Panel', {
                itemId:'item-panel',
                margin:'10 0 0 0',
                border: false,
                defaults: {
                    // applied to each contained panel
                    bodyStyle: 'padding:15px'
                }
            });
            retroItemsPanel= me.down('#item-panel-container').add(retroItemsPanel);
        }
      } catch(e) {
        console.log(e);
      }
      return retroItemsPanel;
    },
    // adds a retro item category panel to the item panel if it doesn't already exist
    // returns a reverence to the category panel
    _addRetroItemCategoryPanel: function(category){
      var me = this;
      var retroItemCategoryPanel = me.down('#panel-'+category);
      try {
        var retroItemPanel = me._addRetroItemsPanel();
        var categoryConstant = _.find(RETRO_CATEGORIES, function(cat){ return cat.key == category;});
        if(retroItemPanel && !retroItemCategoryPanel){
          var categoryDisplay = (categoryConstant)?categoryConstant.display:category;
          var retroItemCategoryPanel = Ext.create('Ext.panel.Panel', {
             title: categoryDisplay,
             itemId:'panel-'+category,
             category: category
          });
          retroItemPanel.add(retroItemCategoryPanel);
        }
      } catch (e) {
        console.log(e);
      }
      return retroItemCategoryPanel;
    },
    // adds all the default retro item category panels as defined by RETRO_CATEGORIES
    _addDefaultRetroCategoryPanels: function(){
      var me = this;
      var retroCategoryPanels = [];
      _.forEach(RETRO_CATEGORIES, function(category) {
            retroCategoryPanels.push(me._addRetroItemCategoryPanel(category.key));
      }, me);
      return retroCategoryPanels;
    },
    // adds a retro item container to the appropriate category panel
    _addRetroItemContainer: function(retroItem){
      var me = this;
      var retroItemContainerRef = {};
      try {
        var retroItemPanel = me._addRetroItemsPanel();
        var retroItemCategoryPanel = me._addRetroItemCategoryPanel(retroItem.category);
        var retroItemContainerRef = me._getRetroItemContainerRef(retroItem);
        if(!retroItemContainerRef){
          var retroItemContainer = me._createItemContainer(retroItem);
          var insertionIndex = _.sortedIndex(retroItemCategoryPanel.items.items, retroItemContainer, 'retroItem.timestamp');
          retroItemContainerRef = retroItemCategoryPanel.insert(insertionIndex, retroItemContainer);
        }
      } catch (e) {
        console.log(e);
      }
      return retroItemContainerRef;
    },
    _updateRetroItemContainer: function(retroItem){
      var me = this;
      var retroItemContainerRef = {};
      try {
        retroItemContainerRef = me._getRetroItemContainerRef(retroItem);
        if(retroItemContainerRef){
            var retroItemContainer = me._createItemContainer(retroItem);
            var parentContainer = retroItemContainerRef.up();
            var retroItemContainerIndex = _.findIndex(parentContainer.items.items, function(container){ return retroItemContainerRef.itemId == container.itemId;});
            parentContainer.remove(retroItemContainerRef);
            parentContainer.insert(retroItemContainerIndex, retroItemContainer);
        }
      } catch (e) {
        console.log(e);
      }
      return retroItemContainerRef;
    },
    _deleteRetroItemContainer: function(retroItem){
      var me = this;
      var retroItemContainerRef = {};
      try {
        retroItemContainerRef = me._getRetroItemContainerRef(retroItem);
        if(retroItemContainerRef){
            var retroItemCategoryPanelRef = retroItemContainerRef.up('#panel-'+retroItem.category);
            retroItemCategoryPanelRef.remove(retroItemContainerRef);
        }
      } catch (e) {
        console.log(e);
      }
      return retroItemContainerRef;

    },
    _getRetroItemContainerRef: function(retroItem){
      var me = this;
      var retroContainerRef = me.down('#retro-item-container-'+retroItem.id);
      return retroContainerRef;
    },

    // Create and Show a Grid of given defect
    // _createGrid: function(myiterationStore) {

    //   var me = this;

    //   this.retroItems = {};
    //   try {
    //     var iterationNotes = myiterationStore.data.items[0].data.Notes;
    //     if (iterationNotes) {
    //       this.retroItems = JSON.parse(iterationNotes);
    //     }
    //     else {
    //       _.forEach(RETRO_CATEGORIES, function(category) {
    //         me.retroItems[category.key] = [];
    //       });
    //     }
    //     console.log('Iteration Feedback Data:', this.retroItems);
    //   } catch (e) {
    //     console.log(e);
    //   }

    //   try {

    //     me.retroItemsPanel = Ext.create('Ext.panel.Panel', {
    //         itemId:'item-panel',
    //       margin:'10 0 0 0',
    //       border: false,
    //         defaults: {
    //             // applied to each contained panel
    //             bodyStyle: 'padding:15px'
    //         }
    //     });
    //   } catch(e) {
    //     console.log(e);
    //   }

    //   me.down('#item-panel-container').add(me.retroItemsPanel);       // add the grid Component to the app-level Container (by doing this.add, it uses the app container)
    //   me._createAccordionPanel();
    // },
// Event handlers -------------------------------------------
    // Handle what happens when the user clicks Submit for a new retroItem.
    _handleSubmitClick: function(button){
      var userResult = Rally.environment.getContext().getUser();
      var me = button.up('#retroApp');
      var tf = me.down('#add-new-text-box').getValue();
      var comboBox = me.down('#add-new-combo-box').getValue();
      var user = '';
      if(me.down('#add-new-anonymous-check-box').getValue()) {
        user = {'name':'Anonymous', 'uid':-1};
      }
      else {
        user = {'name':userResult.UserName, 'uid':userResult.ObjectID};
      }

      // console.log('New Feedback Submitted - ', tf, comboBox, user);
      var newRetroItem ={'id': me._UUID.generate(), 'category': comboBox, 'description': tf, 'user': user, 'voters': [], 'handled':false, 'timestamp':Date.now()};
      //me.retroItems[comboBox].push(newRetroItem);
      //me.down('#panel-'+comboBox).add(me._createItemContainer(newRetroItem));
      //me._updateData();
      me._addRetroItem(newRetroItem);
      me._renderRetroItems();
      me.down('#add-new-text-box').setValue('');
    },
    // Handle what happens when the user clicks Delete for a retroItem.
    _handleDeleteClick: function(button){//
      // console.log('Deleting item');
      var me = button.up('#retroApp');
      var retroItem = button.up('container').retroItem;
      var retroItemContainerRef = me._getRetroItemContainerRef(retroItem);
      me._deleteRetroItem(retroItem);
      me._deleteRetroItemContainer(retroItem);
      me._renderRetroItems();
      // _.forEach(RETRO_CATEGORIES, function(category) {
      //     var itemRef = _.find(me.retroItems[category.key], function(item) {return _.isEqual(item, retroItem)});
      //     if(itemRef){
      //         _.remove(me.retroItems[category.key], itemRef);
      //         var panel = button.up('#panel-'+category.key);
      //         panel.remove(retroContainerBox);
      //         me._createAccordionPanel();
      //     }
      //   }, button);

      // me._updateData();
    },
    // Handle what happens when the user clicks Vote for a retroItem.
    _handleVoteClick: function(button){
      // console.log('Voting on item');
      var me = button.up('#retroApp');
      var controlsContainer = button.up('container');
      var retroItem = controlsContainer.retroItem;
      me._readRetroItems();
      var retroItemRef = me._getRetroItemRef(retroItem);
      var retroItemContainerRef = me._getRetroItemContainerRef(retroItem);
      if(!retroItemRef){
        alert("Retrospective item was deleted in another session.  Sorry for the inconvenience");
      } else {
        var user = {'name':Rally.environment.getContext().getUser().UserName, 'uid':Rally.environment.getContext().getUser().ObjectID};
        var userHasVoted = _.contains(_.pluck(retroItemRef.voters, 'uid'), user.uid);
        if(!userHasVoted){
          retroItemRef.voters.push(user);
          // var userImage = Ext.create('Ext.Img', {
          //     itemId: 'voterImage-image-'+user.uid,
          //     src: 'https://rally1.rallydev.com/slm/profile/viewThumbnailImage.sp?uid=' + user.uid,
          //     height: 25,
          //     width: 25,
          //     margin: 1,
          // });
          // controlsContainer.add(userImage);
        } else {
          var voterRef = _.find(retroItemRef.voters, function(voterRecord) {return _.isEqual(voterRecord, user)});
          _.remove(retroItemRef.voters,voterRef);
          // var userImage = controlsContainer.down('#voterImage-image-'+user.uid);
          // controlsContainer.remove(userImage);
        }
        me._updateRetroItem(retroItemRef);
        // controlsContainer.retroItem = retroItemRef;
        // button.setText(retroItemRef.voters.length);
        // me._toggleButtonState(button);
        me._renderRetroItems();
      }
    },

    // Handle what happens when the user clicks Vote for a retroItem.
    _handleHandledClick: function(button){
      var me = button.up('#retroApp');
      var controlsContainer = button.up('container');
      var retroItem = controlsContainer.retroItem;
      me._readRetroItems();
      var retroItemRef = me._getRetroItemRef(retroItem);
      var retroItemContainerRef = me._getRetroItemContainerRef(retroItem);
      if(!retroItemRef){
        alert("Retrospective item was deleted in another session.  Sorry for the inconvenience");
      } else {
        retroItemRef.handled = !retroItemRef.handled;
        me._updateRetroItem(retroItemRef);
        me._renderRetroItems();
      }
      // var retroContainer = button.up('container');
      // var retroItem = retroContainer.retroItem;

      // var me = button.up('#retroApp');

      // // toggle cls on button press
      // me._toggleButtonState(button);

      // _.forEach(RETRO_CATEGORIES, function(category) {
      //     var itemRef = _.find(me.retroItems[category.key], function(item) {return _.isEqual(item, retroItem)});
      //     if(itemRef){
      //       itemRef.handled = !itemRef.handled;
      //       retroItem.handled = !retroItem.handled;
      //     }
      //   });
      //   //https://lodash.com/docs#forEach
      // me._updateData();
    },

    // _toggleButtonState: function(button) {
    //   if (button.hasCls('primary')) {
    //     button.removeCls('primary');
    //     button.addCls('secondary');
    //   } else {
    //     button.removeCls('secondary');
    //     button.addCls('primary');
    //   }
    // },

    // create the UI container for a retroItem
    // 'this' is expected to be the CustomApp
    _createItemContainer: function(retroItem) {
      var me = this;
      // console.log(retroItem);
      // console.log(me);
      // var textBox = Ext.create('Ext.draw.Text', {
      //     itemId: 'text-retro-item',
      //     text: retroItem.description,
      //     fontFamily: '',
      //     font: 16
      //   });
      var textBox = {
        border: 0,
        marginTop: 0,

        html: '<div style="font-size: 13px;">' + retroItem.description + '</div>'
      };
      var button = Ext.create('Rally.ui.Button', {
          itemId: 'delete-retro-item-button',
          iconCls: 'icon-delete',
          cls:'secondary rly-small',
          handler: me._handleDeleteClick,
          align: 'right',
          disabled: false
        });
      var user = {'name':Rally.environment.getContext().getUser().UserName, 'uid':Rally.environment.getContext().getUser().ObjectID};
      var userHasVoted = _.contains(_.pluck(retroItem.voters, 'uid'), user.uid);
      // var userHasVoted = _.contains(retroItem.voters, Rally.environment.getContext().getUser().ObjectID);
      var votedLabelTxt = retroItem.voters?retroItem.voters.length:"";
      var voteButton = Ext.create('Rally.ui.Button', {
          itemId: 'vote-retro-item-button',
          cls: ((userHasVoted) ? 'primary' : 'secondary') + ' rly-small',
          iconCls: 'icon-thumbs-up',
          text: votedLabelTxt,
          handler: me._handleVoteClick,
          align: 'right',
        });
      var handledButton = Ext.create('Rally.ui.Button', {
          itemId: 'handled-retro-item-button',
          iconCls: 'icon-ready',
          cls: ((retroItem.handled)?'primary':'secondary')+' rly-small',
          handler: me._handleHandledClick,
          added: me._setHandledButtonState,
          align: 'right'
        });
      handledButton.applyState(retroItem.handled);

      var imgURI = 'https://help.rallydev.com/apps/2.0/doc/images/main-header-logo.png';
      if (retroItem.user && retroItem.user.uid > 0) {
        imgURI = 'https://rally1.rallydev.com/slm/profile/viewThumbnailImage.sp?uid=' + retroItem.user.uid;
      }
      var submitterImage = Ext.create('Ext.Img', {
          itemId: 'submitter-image',
          src: imgURI,
          height: 25,
          width: 25
      });

      var textSeparator = Ext.create('Ext.draw.Text', {
          itemId: 'separatorText',
          text: '',
          width: 25,
          layout: {
            align: 'center'
          },
      });
      var items = [submitterImage, textSeparator, handledButton, button, voteButton];
      _.forEach(retroItem.voters, function(voter) {
        var voterImage = Ext.create('Ext.Img', {
            itemId: 'voterImage-image-'+voter.uid,
            src: 'https://rally1.rallydev.com/slm/profile/viewThumbnailImage.sp?uid=' + voter.uid,
            height: 25,
            width: 25,
            margin: 1,
        });
        items.push(voterImage);
      });
      var controls = Ext.create('Ext.container.Container', {
        itemId: 'controls-container',
        layout: {
          type: 'hbox'
        },
        items: items,
        retroItem: retroItem
      });

      return Ext.create('Ext.container.Container', {
                          layout: {
                                  type: 'vbox'
                          },
                          // cls: 'retro-item-container',
                          itemId: 'retro-item-container-'+retroItem.id,

                          padding: 5,
                          border: 1,

                          items: [controls, textBox],
                          retroItem: retroItem
                        });
    },

    // // Creates an array of retroItem Components according to the contents of retroItems
    // // 'this' is expected to be the CustomApp
    // _createAccordionItems: function() {
    //   var me = this;
    //   console.log(me);
    //   return _.map(RETRO_CATEGORIES, function(category) {
    //           return {
    //             title: category.display,
    //             itemId: 'panel-'+category.key,
    //             items: _.map(me.retroItems[category.key], me._createItemContainer, me),
    //             category: category
    //           };
    //         },me);
    // },

    // // Update the UI accordion panel according to the contents of retroItems
    // // 'this' is expected to be the CustomApp
    // _createAccordionPanel: function(){
    //   var me = this;
    //   var accordion = me.down('#item-panel');
    //   accordion.removeAll();
    //   _.map(me._createAccordionItems(), function(item) {
    //     accordion.add(item);
    //   })
    // },

    /** Generates UUID v4
     *
     * @node There is a bug in Chrome's Math.random() according to http://devoluk.com/google-chrome-math-random-issue.html
     *       For that reason we use Date.now() as well.
     */
    _UUID: {
        h: function (n) { return (n|0).toString(16); },
        s: function (n) { return this.h((Math.random() * (1<<(n<<2)))^Date.now()).slice(-n); },
        generate: function(){
          return  [
            this.s(4) + this.s(4), this.s(4),
            '4' + this.s(3),                    // UUID version 4
            this.h(8|(Math.random()*4)) + this.s(3), // {8|9|A|B}xxx
            // s(4) + s(4) + s(4),
            Date.now().toString(16).slice(-10) + this.s(2) // Use timestamp to avoid collisions
        ].join('-');

        }
    }

});
