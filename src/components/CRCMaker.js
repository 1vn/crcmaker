import React, { Component } from 'react';
import Clipboard from 'clipboard';

import Card from './Card';
import CardTypes from '../constants/CardTypes';
import Dialog from './Dialog';
import NewCardForm from './NewCardForm';
import Toast from './Toast';
import PDFDocument from 'pdfkit';
import blobStream from 'blob-stream';

/**
 * The "entry point" of the app.
 * This class maintains the main state, including the cards themselves.
 */
export default class CRCMaker extends Component {
  constructor (props) {
    super(props);

    // Parse URL for encoded data
    const shareParamRes = new RegExp('[\\?&]share=([^&#]*)').exec(location.search);

    // An array of cards from the URL or localStorage, if available
    const cardsData = shareParamRes ?
      JSON.parse(atob(decodeURIComponent(shareParamRes[1].replace(/\+/g, ' ')))) :
      localStorage.cards ?
        JSON.parse(localStorage.cards) :
        [];

    // Initial state
    this.state = {
      // Card object + index that's being edited
      editCard        : null,
      editIndex       : null,

      // Load cards from either localStorage or URL param (defaults to empty array)
      cards           : cardsData,

      // Whether or not the card creation/editor form is visible
      formVisible     : false,

      // Whether or not the header UI is visible
      controlsVisible : true,

      // The generated URL for sharing
      shareLink       : '',

      // Whether or not to show the textbox with the share link
      shareVisible    : false,

      // Export JSON dialog
      exportVisible   : false,

      // Show toast message indicating copy action
      toastVisible    : false,

      // Message to show in toast
      toastText       : ''
    };

    this.displayToast = this.displayToast.bind(this);
    this.toggleNewCardForm = this.toggleNewCardForm.bind(this);
    this.toggleHeader = this.toggleHeader.bind(this);
    this.addCard = this.addCard.bind(this);
    this.editCard = this.editCard.bind(this);
    this.cancelAddCard = this.cancelAddCard.bind(this);
    this.removeCard = this.removeCard.bind(this);
    this.removeAllCards = this.removeAllCards.bind(this);
    this.moveCardUp = this.moveCardUp.bind(this);
    this.moveCardDown = this.moveCardDown.bind(this);
    this.generateShareLink = this.generateShareLink.bind(this);
    this.onShareClose = this.onShareClose.bind(this);
    this.toggleExport = this.toggleExport.bind(this);
    this.generatePDF = this.generatePDF.bind(this);
  }

  componentDidMount () {
    const clipboard = new Clipboard('.copy');

    clipboard.on('success', (e) => {
      this.displayToast('Copied to clipboard!');
    });

    clipboard.on('error', (e) => {
      this.displayToast('Press Ctrl/⌘+C to copy.');
    });
  }

  componentDidUpdate (prevProps, prevState) {
    if (this.state.cards.length > 0) {
      // Sync cards in state object with localStorage
      localStorage.cards = JSON.stringify(this.state.cards);
    } else {
      // Clear localStorage if there's no cards
      localStorage.clear();
    }
  }

  displayToast (text, duration = 2500) {
    this.setState({
      toastVisible : true,
      toastText    : text
    }, () => {
      setTimeout(() => {
        this.setState({
          toastVisible: false
        });
      }, duration);
    });
  }

  toggleNewCardForm () {
    this.setState({
      formVisible: !this.state.formVisible
    });
  }

  toggleHeader () {
    this.setState({
      controlsVisible: !this.state.controlsVisible
    });
  }

  addCard (data) {
    var cardsData = this.state.cards;

    if (this.state.editIndex !== null) {
      // Replace existing card (used for editing)
      cardsData[this.state.editIndex] = data;
    } else {
      // Add to array in state (new card)
      cardsData.push(data);
    }

    this.setState({
      editCard    : null,
      editIndex   : null,
      cards       : cardsData,
      formVisible : false
    });
  }

  editCard (index) {
    this.setState({
      editCard    : this.state.cards[index],
      editIndex   : index,
      formVisible : true
    });
  }

  cancelAddCard () {
    this.setState({
      editCard    : null,
      editIndex   : null,
      formVisible : false
    });
  }

  removeCard (index) {
    if (confirm(`Remove card #${index + 1}?`)) {
      var cardsData = this.state.cards;
      cardsData.splice(index, 1);

      this.setState({
        cards: cardsData
      });
    }
  }

  removeAllCards () {
    if (confirm('Remove all cards?')) {
      this.setState({
        cards: []
      });
    }
  }

  moveCardUp (index) {
    var cardsData = this.state.cards;

    var thisCard = cardsData[index];

    cardsData[index] = cardsData[index - 1]
    cardsData[index - 1] = thisCard;

    this.setState({
      cards: cardsData
    });
  }

  moveCardDown (index) {
    var cardsData = this.state.cards;

    var thisCard = cardsData[index];

    cardsData[index] = cardsData[index + 1]
    cardsData[index + 1] = thisCard;

    this.setState({
      cards: cardsData
    });
  }

  generateShareLink () {
    const cleanUrl = `${location.protocol}//${location.host}${location.pathname}`,
      encoded  = this.state.cards.length > 0 ? btoa(JSON.stringify(this.state.cards)) : null;

    this.setState({
      shareLink    : encoded ? `${cleanUrl}?share=${encoded}` : cleanUrl,
      shareVisible : true
    });
  }

  onDialogTextClick (e) {
    // Selects all text in input box
    e.target.select();
  }

  onShareClose () {
    this.setState({
      shareVisible: false
    });
  }

  toggleExport () {
    this.setState({
      exportVisible: !this.state.exportVisible
    });
  }

  // http://stackoverflow.com/a/7220510
  syntaxHighlight (json) {
    if (typeof json !== 'string') {
      json = JSON.stringify(json, undefined, 2);
    }
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'number';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'key' : 'string';
      } else if (/true|false/.test(match)) {
        cls = 'boolean';
      } else if (/null/.test(match)) {
        cls = 'null';
      }
      return `<span class="${cls}">${match}</span>`;
    });
  }

  generatePDF () {
    window.scrollTo(0, 0);
    var doc = new PDFDocument()
    var stream = doc.pipe(blobStream());
    
    var cursorX = 20;
    var cursorY = 20;

    var threshold = (72 * 11) - 20

    this.state.cards.map((data, i) => {
      //get height of card
      var maxItems = Math.max(data.responsibilities.length, data.collaborators.length);
      var height = maxItems*15 + 100;
      var width = 572

      if(cursorY + height > threshold){
        doc.addPage();
        cursorY = 20;
      } 

      let type = '';
      if (data.type == CardTypes.ABSTRACT) {
        type = 'Abstract';
      } else if (data.type == CardTypes.INTERFACE) {
        type = 'Interface';
      }
      var superclasses = data.superclasses;
      var name = data.name;
      var subclasses = data.subclasses;

      doc.fontSize(15);
      doc.text(type, cursorX + 3, cursorY + 10);
      doc.text(superclasses, width - doc.widthOfString(superclasses) + 15, cursorY + 10, {width: doc.widthOfString(superclasses)});
      doc.text(subclasses, width - doc.widthOfString(subclasses) + 15, cursorY + 50, {width: doc.widthOfString(subclasses)});
      doc.fontSize(20);
      doc.text(name, (width - doc.widthOfString(name)/2)/2, cursorY + 36, {width: doc.widthOfString(name)});
      doc.fontSize(15);

      doc.rect(cursorX, cursorY, width, height).stroke();

      cursorY += 72;

      var bottomBoxHeight = Math.max(43, 28 + maxItems*15);
      doc.moveTo(cursorX, cursorY).lineTo(cursorX+width, cursorY).stroke();
      doc.moveTo(cursorX + 429, cursorY).lineTo(cursorX + 429, cursorY + bottomBoxHeight).stroke();
     
      doc.fontSize(12);
      doc.list(data.responsibilities, cursorX+5, cursorY+15, {bulletIndex: true});
      doc.list(data.collaborators, cursorX+434, cursorY+15, {bulletIndex: true});

      cursorY += bottomBoxHeight + 50;
    })

    doc.end();
    stream.on('finish', function() {
      window.location.href = stream.toBlobURL('application/pdf');
    });
  }

  render () {
    const state = this.state;

    return (
      <div>
        { state.controlsVisible &&
          <header className='header'>
            <h1 className='header__title'>CRC Card Maker</h1>

            <p className='header__info'>Tip: The header/buttons are hidden when printing!</p>

            { state.cards.length > 0 && (
              <div className='header__actions'>
                <button onClick={this.toggleNewCardForm}>New card</button>

                <button onClick={this.removeAllCards}>Remove all</button>

                <button onClick={this.generateShareLink}>Share link</button>
                { state.shareVisible &&
                  <Dialog title='Share' onClose={this.onShareClose}>
                    <input id='text-share' className='dialog__text' type='text' value={state.shareLink}
                      onClick={this.onDialogTextClick} readOnly />

                    <button className='copy' data-clipboard-target='#text-share'>Copy</button>
                    <button onClick={this.onShareClose}>Close</button>
                  </Dialog>
                }

                <button onClick={this.toggleExport}>Export</button>
                <button onClick={this.generatePDF}>PDF</button>
                { state.exportVisible &&
                  <Dialog title='Export JSON' onClose={this.toggleExport}>
                    <pre id='text-export' className='syntax'
                      dangerouslySetInnerHTML={{__html: this.syntaxHighlight(state.cards)}} />

                    <button className='copy' data-clipboard-target='#text-export'>Copy</button>
                    <button onClick={this.toggleExport}>Close</button>
                  </Dialog>
                }

                <button onClick={() => { window.print(); }}>Print</button>
              </div>
            ) }

            { state.formVisible &&
              <NewCardForm onAdd={this.addCard} onCancel={this.cancelAddCard}
                data={state.editCard} />
            }
          </header>
        }

        <button className='btn--small' onClick={this.toggleHeader}>Show/hide controls</button>

        <main className='cards' id='cards'>
          { state.cards.length === 0 &&
            <div className='cards__empty'>
              <p>You don't have any cards yet.</p>
              <button onClick={this.toggleNewCardForm}>New card</button>
            </div>
          }

          { state.cards.map((card, i) =>
            <div key={i} className='card__wrapper'>
              <Card data={card} />

              { state.controlsVisible &&
                <div>
                  <button className='btn--small'
                    onClick={this.editCard.bind(this, i)}>Edit card #{i + 1}</button>
                  <button className='btn--small'
                    onClick={this.removeCard.bind(this, i)} title={`Remove card #${i + 1}`}>✕</button>

                  { i !== 0 &&
                    <button className='btn--small'
                      onClick={this.moveCardUp.bind(this, i)} title='Move card up'>↑</button>
                  }

                  { i !== state.cards.length - 1 &&
                    <button className='btn--small'
                      onClick={this.moveCardDown.bind(this, i)} title='Move card down'>↓</button>
                  }
                </div>
              }
            </div>
          ) }
        </main>

        <Toast visible={state.toastVisible}>{state.toastText}</Toast>
      </div>
    );
  }
}
