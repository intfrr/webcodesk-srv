/*
 *    Copyright 2019 Alex (Oleksandr) Pustovalov
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import constants from '../../../commons/constants';
import SplitPane from '../splitPane';
import IFrame from './IFrame';
import FlowDebugger from './FlowDebugger';
import PagesList from './PagesList';
import { CommonToolbar, CommonToolbarDivider } from '../commons/Commons.parts';
import ToolbarButton from '../commons/ToolbarButton';
import ToolbarField from "../commons/ToolbarField";
import SettingsPropsTree from './SettingsPropsTree';
import globalStore from '../../core/config/globalStore';

const styles = theme => ({
  root: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
  },
  webviewCentralPane: {
    position: 'absolute',
    top: '39px',
    bottom: 0,
    right: 0,
    left: 0,
  },
  leftPane: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
  },
  debuggerCentralPane: {
    position: 'absolute',
    top: '39px',
    bottom: 0,
    right: 0,
    left: 0,
  },
  topPane: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '39px',
    right: 0,
    minWidth: '800px'
  },
  editorPane: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
    overflow: 'auto',
  }
});

class LivePreview extends React.Component {
  static propTypes = {
    dataId: PropTypes.string,
    isVisible: PropTypes.bool,
    pages: PropTypes.array,
    settings: PropTypes.array,
    serverPort: PropTypes.number,
    onOpenUrl: PropTypes.func,
    onSearchRequest: PropTypes.func,
    onError: PropTypes.func,
    onUpdateSettings: PropTypes.func,
  };

  static defaultProps = {
    dataId: '',
    isVisible: true,
    pages: [],
    settings: [],
    serverPort: -1,
    onOpenUrl: () => {
      console.info('LivePreview.onOpenUrl is not set');
    },
    onSearchRequest: () => {
      console.info('LivePreview.onSearchRequest is not set');
    },
    onError: () => {
      console.info('LivePreview.onError is not set');
    },
    onUpdateSettings: () => {
      console.info('LivePreview.onUpdateSettings is not set');
    },
  };

  constructor (props) {
    super(props);
    this.actionSequences = {};
    this.actionLog = [];
    this.iFrameRef = React.createRef();
    let indexPage;
    const { pages } = this.props;
    if (pages && pages.length > 0) {
      indexPage = pages.find(i => i.pagePath === 'main');
      if (!indexPage) {
        indexPage = pages[0];
      }
    }
    this.state = {
      iFrameWidthIndex: this.getViewFlag('iFrameWidthIndex', 0),
      isRecordingFrameworkMessages: false,
      isDebugFlowOpen: false,
      activePage: indexPage,
      activeUrl: indexPage ? `/${indexPage.pagePath}`: '/',
      showPagesList: this.getViewFlag('showPagesList', false),
      showPanelCover: false,
      frameUrl: null,
      selectedDebugTitle: null,
      selectedDebugClass: null,
      initializationDebugMessageCount: 0,
      showSettingsEditor: this.getViewFlag('showSettingsEditor', false),
      pagesListSplitterSize: this.getViewFlag('pagesListSplitterSize', 300),
      settingsEditorSplitterSize: this.getViewFlag('settingsEditorSplitterSize', 250),
    };
  }

  componentDidMount () {
    window.document.addEventListener('keydown', this.handleKeyDown);
  }

  componentWillUnmount () {
    window.document.removeEventListener('keydown', this.handleKeyDown);
  }

  shouldComponentUpdate (nextProps, nextState, nextContext) {
    const { isVisible, pages, serverPort } = this.props;
    const {
      iFrameWidthIndex,
      isRecordingFrameworkMessages,
      isDebugFlowOpen,
      activePage,
      activeUrl,
      showPagesList,
      showPanelCover,
      frameUrl,
      selectedDebugTitle,
      selectedDebugClass,
      initializationDebugMessageCount,
      showSettingsEditor,
      pagesListSplitterSize,
      settingsEditorSplitterSize
    } = this.state;
    return iFrameWidthIndex !== nextState.iFrameWidthIndex
      || isRecordingFrameworkMessages !== nextState.isRecordingFrameworkMessages
      || activePage !== nextState.activePage
      || activeUrl !== nextState.activeUrl
      || isDebugFlowOpen !== nextState.isDebugFlowOpen
      || showPagesList !== nextState.showPagesList
      || showPanelCover !== nextState.showPanelCover
      || frameUrl !== nextState.frameUrl
      || selectedDebugTitle !== nextState.selectedDebugTitle
      || selectedDebugClass !== nextState.selectedDebugClass
      || initializationDebugMessageCount !== nextState.initializationDebugMessageCount
      || showSettingsEditor !== nextState.showSettingsEditor
      || pagesListSplitterSize !== nextState.pagesListSplitterSize
      || settingsEditorSplitterSize !== nextState.settingsEditorSplitterSize
      || isVisible !== nextProps.isVisible
      || pages !== nextProps.pages
      || serverPort !== nextProps.serverPort;
  }

  storeViewFlag = (flagName, flagValue) => {
    const { dataId } = this.props;
    if (dataId) {
      const recordViewFlags = globalStore.get(constants.STORAGE_RECORD_LIVE_PREVIEW_FLAGS) || {};
      const viewFlags = recordViewFlags[dataId] || {};
      viewFlags[flagName] = flagValue;
      recordViewFlags[dataId] = viewFlags;
      globalStore.set(constants.STORAGE_RECORD_LIVE_PREVIEW_FLAGS, recordViewFlags, true);
    }
  };

  getViewFlag = (flagName, flagDefaultValue) => {
    const { dataId } = this.props;
    if (dataId) {
      const recordViewFlags = globalStore.get(constants.STORAGE_RECORD_LIVE_PREVIEW_FLAGS) || {};
      const viewFlags = recordViewFlags[dataId] || {};
      const viewFlag = viewFlags[flagName];
      return typeof viewFlag === 'undefined' ? flagDefaultValue : viewFlag;
    }
    return flagDefaultValue;
  };

  handleKeyDown = (e) => {
    if (
      this.props.isVisible
      && e
      && e.target
      && e.target.tagName !== 'INPUT'
      && e.target.tagName !== 'TEXTAREA'
    ) {
      const {keyCode, metaKey, ctrlKey} = e;
      if (metaKey || ctrlKey) {
        if (keyCode === 82) { // Reload
          this.handleReload();
        }
      }
      e.stopPropagation();
      e.preventDefault();
    }
  };

  handleReload = () => {
    if (this.iFrameRef.current) {
      this.iFrameRef.current.reloadPage();
    }
  };

  handleToggleWidth = (widthIndex) => () => {
    this.storeViewFlag('iFrameWidthIndex', widthIndex);
    this.setState({
      iFrameWidthIndex: widthIndex,
    });
  };

  handleFrameworkMessage = (message) => {
    if (message) {
      const { type, payload } = message;
      if (type === constants.FRAMEWORK_MESSAGE_INIT_DEBUG) {
        const { actionSequences } = payload;
        this.actionSequences = actionSequences;
        this.actionLog = [];
        this.setState({
          initializationDebugMessageCount: this.state.initializationDebugMessageCount + 1
        })
      } else if (type === constants.FRAMEWORK_MESSAGE_DEBUG) {
        this.actionLog.push(payload);
      } else if (type === constants.FRAMEWORK_MESSAGE_CHANGE_URL) {
        this.setState({
          activeUrl: payload,
        });
      }
    }
  };

  handleToggleRecording = () => {
    const isRecordingFrameworkMessages = this.state.isRecordingFrameworkMessages;
    const newState = {
      isRecordingFrameworkMessages: !isRecordingFrameworkMessages,
    };
    if (this.iFrameRef.current) {
      if (isRecordingFrameworkMessages) {
        this.iFrameRef.current.sendMessage({
          type: constants.WEBCODESK_MESSAGE_STOP_LISTENING_TO_FRAMEWORK
        });
        newState.isDebugFlowOpen = true;
      } else {
        this.iFrameRef.current.sendMessage({
          type: constants.WEBCODESK_MESSAGE_START_LISTENING_TO_FRAMEWORK
        });
        newState.isDebugFlowOpen = false;
      }
    }
    this.setState(newState);
  };

  handleToggleDebugFlow = () => {
    this.setState({
      isDebugFlowOpen: !this.state.isDebugFlowOpen,
      selectedDebugTitle: null,
      selectedDebugClass: null,
    });
  };

  handleSearchRequest = (text) => () => {
    this.props.onSearchRequest(text);
  };

  handleTogglePagesList = () => {
    this.storeViewFlag('showPagesList', !this.state.showPagesList);
    this.setState({
      showPagesList: !this.state.showPagesList,
    });
  };

  handleSplitterOnDragStarted = () => {
    this.setState({
      showPanelCover: true,
    });
  };

  handleSplitterOnDragFinished = (splitterName) => (newSplitterSize) => {
    this.storeViewFlag(splitterName, newSplitterSize);
    this.setState({
      showPanelCover: false,
    });
  };

  handleChangeActivePage = (page) => {
    this.setState({
      activePage: page,
    });
    this.handleChangeActiveUrl(page ? `/${page.pagePath}` : this.state.activeUrl);
  };

  handleChangeActiveUrl = (url) => {
    const { serverPort } = this.props;
    this.setState({
      activeUrl: url,
    });
    if(this.iFrameRef.current) {
      this.iFrameRef.current.loadURL(`http://localhost:${serverPort}${url}`);
    }
  };

  handleFrameReady = (url) => {
    const { serverPort } = this.props;
    this.setState({
      frameUrl: url ? url.replace(`http://localhost:${serverPort}`, '') : '',
    })
  };

  handleOpenExternal = () => {
    const { serverPort } = this.props;
    this.props.onOpenUrl(`http://localhost:${serverPort}${this.state.frameUrl}`);
  };

  handleDebugSelected = ({searchName, className}) => {
    this.setState({
      selectedDebugTitle: searchName,
      selectedDebugClass: className,
    });
  };

  handleToggleSettingsEditor = () => {
    this.storeViewFlag('showSettingsEditor', !this.state.showSettingsEditor);
    this.setState({
      showSettingsEditor: !this.state.showSettingsEditor,
    });
  };

  handleUpdateSettings = (settings) => {
    this.props.onUpdateSettings(settings);
  };

  render () {
    const {
      classes,
      pages,
      settings,
      serverPort
    } = this.props;
    const {
      iFrameWidthIndex,
      isRecordingFrameworkMessages,
      isDebugFlowOpen,
      activePage,
      activeUrl,
      showPagesList,
      showPanelCover,
      frameUrl,
      selectedDebugTitle,
      selectedDebugClass,
      isExportStarted,
      showSettingsEditor,
      pagesListSplitterSize,
      settingsEditorSplitterSize
    } = this.state;
    const menuItems = [];
    if (isDebugFlowOpen) {
      if (selectedDebugTitle) {
        menuItems.push({
          label: `By name: "${selectedDebugTitle}"`,
          onClick: this.handleSearchRequest(selectedDebugTitle)
        });
      }
      if (selectedDebugClass) {
        menuItems.push({
          label: `By class: "${selectedDebugClass}"`,
          onClick: this.handleSearchRequest(selectedDebugClass)
        });
      }
    }
    return (
      <div className={classes.root}>
        <div className={classes.topPane}>
          {isDebugFlowOpen
            ? (
              <CommonToolbar disableGutters={true} dense="true">
                <ToolbarButton
                  iconType="ArrowBack"
                  onClick={this.handleToggleDebugFlow}
                  title="Back to Live Preview"
                  tooltip="Close current recording diagram"
                />
                <ToolbarButton
                  disabled={!selectedDebugTitle}
                  title="Search"
                  iconType="Search"
                  tooltip="Search for the particle in the project"
                  menuItems={menuItems}
                />
              </CommonToolbar>
            )
            : (
              <CommonToolbar disableGutters={true} dense="true">
                <ToolbarButton
                  switchedOn={showPagesList}
                  onClick={this.handleTogglePagesList}
                  title="Pages"
                  iconType="CollectionsBookmark"
                  tooltip="Show available pages list"
                />
                <ToolbarButton
                  switchedOn={showSettingsEditor}
                  onClick={this.handleToggleSettingsEditor}
                  title="Settings"
                  iconType="SettingsApplications"
                  tooltip="Show global application settings"
                />
                <CommonToolbarDivider />
                {isRecordingFrameworkMessages
                  ? (
                    <ToolbarButton
                      iconType="Stop"
                      iconColor="#E53935"
                      switchedOn={true}
                      onClick={this.handleToggleRecording}
                      title="Stop Recording"
                      tooltip="Stop recording actions for debug"
                    />
                  )
                  : (
                    <ToolbarButton
                      iconType="FiberManualRecord"
                      iconColor="#E53935"
                      switchedOn={false}
                      onClick={this.handleToggleRecording}
                      title="Record Actions"
                      tooltip="Start recording actions for debug"
                      disabled={isExportStarted}
                    />
                  )
                }
                <CommonToolbarDivider />
                <ToolbarButton
                  iconType="Refresh"
                  title="Reload"
                  onClick={this.handleReload}
                  disabled={isRecordingFrameworkMessages}
                  tooltip="Reload the entire page (⌘+r | ctrl+r)"
                />
                <ToolbarButton
                  iconType="OpenInBrowser"
                  title="Open URL"
                  disabled={isRecordingFrameworkMessages}
                  tooltip="Open the current page URL in the browser"
                  onClick={this.handleOpenExternal}
                />
                <CommonToolbarDivider />
                <ToolbarButton
                  iconType={constants.MEDIA_WIDTHS[iFrameWidthIndex].iconType}
                  title={constants.MEDIA_WIDTHS[iFrameWidthIndex].label}
                  tooltip={constants.MEDIA_WIDTHS[iFrameWidthIndex].tooltip}
                  titleLengthLimit={200}
                  menuItems={constants.MEDIA_WIDTHS.map((mediaWidthItem, itemIndex) => {
                    return {
                      label: mediaWidthItem.label,
                      iconType: mediaWidthItem.iconType,
                      tooltip: mediaWidthItem.tooltip,
                      onClick: this.handleToggleWidth(itemIndex),
                    }
                  })}
                />
                <CommonToolbarDivider />
                <ToolbarField
                  iconType="OpenInBrowser"
                  disabled={!frameUrl}
                  text={frameUrl || 'Loading...'}
                  buttonTitle="Open the current page URL in the browser"
                  placeholderText="Page path"
                  onSubmit={this.handleChangeActiveUrl}
                  onButtonClick={this.handleOpenExternal}
                />
              </CommonToolbar>
            )
          }
        </div>
        {isDebugFlowOpen
          ? (
            <div className={classes.debuggerCentralPane}>
              <FlowDebugger
                actionSequences={this.actionSequences}
                actionsLog={this.actionLog}
                onSelectNode={this.handleDebugSelected}
              />
            </div>
          )
          : (
            <div className={classes.webviewCentralPane}>
              <SplitPane
                split="vertical"
                defaultSize={pagesListSplitterSize}
                onDragStarted={this.handleSplitterOnDragStarted}
                onDragFinished={this.handleSplitterOnDragFinished('pagesListSplitterSize')}
                pane1Style={{ display: showPagesList ? 'block' : 'none' }}
                resizerStyle={{ display: showPagesList ? 'block' : 'none' }}
              >
                <div className={classes.leftPane} style={{ overflow: 'auto' }}>
                  <PagesList
                    pages={pages}
                    selectedPage={activePage}
                    onChangeSelected={this.handleChangeActivePage}
                  />
                </div>
                <SplitPane
                  split="vertical"
                  primary="second"
                  defaultSize={settingsEditorSplitterSize}
                  onDragStarted={this.handleSplitterOnDragStarted}
                  onDragFinished={this.handleSplitterOnDragFinished('settingsEditorSplitterSize')}
                  pane2Style={{display: showSettingsEditor ? 'block' : 'none'}}
                  resizerStyle={{display: showSettingsEditor ? 'block' : 'none'}}
                >
                <div className={classes.root}>
                  {showPanelCover && (
                    <div className={classes.root} style={{ zIndex: 10 }}/>
                  )}
                  {serverPort > 0 && (
                    <IFrame
                      key={`livePreview${serverPort}`}
                      ref={this.iFrameRef}
                      width={constants.MEDIA_WIDTHS[iFrameWidthIndex].width}
                      url={`http://localhost:${serverPort}${activeUrl}`}
                      onIFrameMessage={this.handleFrameworkMessage}
                      onIFrameReady={this.handleFrameReady}
                    />
                  )}
                </div>
                <div className={classes.editorPane}>
                  <SettingsPropsTree
                    settingsProperties={settings}
                    onUpdateSettingsProperties={this.handleUpdateSettings}
                  />
                </div>
                </SplitPane>
              </SplitPane>
            </div>
          )
        }
      </div>
    );
  }
}

export default withStyles(styles)(LivePreview);
