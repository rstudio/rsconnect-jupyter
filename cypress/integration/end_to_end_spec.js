const JUPYTER = Cypress.env('JUPYTER')
const MOCK_CONNECT = Cypress.env('MOCK_CONNECT')
const API_KEY = Cypress.env('API_KEY')

describe('End to end', {
  baseUrl: JUPYTER
}, () => {
  beforeEach(() => {
    cy.visit('/')
  })

  before(() => {
    cy.visit('/')
    cy.get('#refresh_notebook_list').should('be.visible').click()
    cy.get('#button-select-all').should('be.visible').click()
    cy.get('body').then(($body) => {
      const $deleteButtons = $body.find('button.delete-button')
      if (($deleteButtons.length === 0) || (!$deleteButtons.is(':visible'))) {
        return
      }
      cy.get('button.delete-button').should('be.visible').click()
      cy.get('div.modal-footer').should('be.visible').contains('Delete').click()
      cy.get('#refresh_notebook_list').should('be.visible').click()
      cy.wait(3000)
    })
  })

  it('Creates and opens a new notebook', () => {
    cy.contains('New').click()
    cy.contains('Python 3').click()
    cy.get('#refresh_notebook_list').should('be.visible').click()
    cy.get('.item_link')
      .should('have.attr', 'href')
      .and('include', 'notebooks')
      .then(($href) => {
        cy.visit($href)
      })
  })

  it('Registers the new server address', () => {
    cy.get('.item_link')
      .should('have.attr', 'href').and('include', 'notebooks')
      .then((href) => {
        cy.visit(href)
      })
    cy.get('.rsc-dropdown [data-jupyter-action="rsconnect_jupyter:publish"]').should('be.visible').click()
    cy.get('#publish-to-connect').should('be.visible').click()

    const typeOptions = { delay: 20 }
    cy.get('div.modal-dialog').should('be.visible').then(($modal) => {
      if ($modal.find('#rsc-select-server').length) {
        cy.get('#rsc-select-server button').should('be.visible').click()
      }
      if ($modal.find('#rsc-add-server').length) {
        cy.get('#rsc-add-server').should('be.visible').click()
      }
    })
    cy.wait(1000)
    cy.get('#rsc-servername').type('mock-connect', typeOptions)
    cy.get('#rsc-server').should('be.visible').type(MOCK_CONNECT, typeOptions)
    cy.get('#rsc-api-key').should('be.visible').type(API_KEY, typeOptions)
    cy.get('.modal-footer').should('be.visible').contains('Add Server').click()
    cy.get('#rsc-select-server a.list-group-item')
      .should('be.visible')
      .contains('mock-connect')
      .contains(MOCK_CONNECT)
      .then(($a) => {
        if (!$a.hasClass('active')) {
          cy.wrap($a).click()
        }
      })
  })

  it('Publishes with source', () => {
    cy.get('.item_link')
      .should('have.attr', 'href').and('include', 'notebooks')
      .then((href) => {
        cy.visit(href)
      })
    cy.get('.rsc-dropdown [data-jupyter-action="rsconnect_jupyter:publish"]').should('be.visible').click()
    cy.get('#publish-to-connect').should('be.visible').click()

    cy.get('#rsc-publish-with-source').should('be.visible').click()
    cy.get('#rsc-select-server a.list-group-item').should('be.visible').then(($a) => {
      if (!$a.hasClass('active')) {
        cy.wrap($a).click()
      }
    })
    cy.get('.modal-footer').should('be.visible').contains('Publish').click()
    cy.get('.modal-body #new-location').should('be.visible').click()
    cy.get('.modal-footer').should('be.visible').contains('Next').click()
    cy.get('.modal-footer a.btn-primary').should('be.visible').click()
  })

  it.skip('Publishes static', () => {
    cy.get('.item_link')
      .should('have.attr', 'href').and('include', 'notebooks')
      .then((href) => {
        cy.visit(href)
      })
    cy.get('.rsc-dropdown [data-jupyter-action="rsconnect_jupyter:publish"]').should('be.visible').click()
    cy.get('#publish-to-connect').should('be.visible').click()

    cy.get('#rsc-publish-without-source').should('be.visible').click()
    cy.get('#rsc-content-title').should('be.visible').type('Holding Very Still')
    cy.get('#rsc-select-server a.list-group-item').should('be.visible').then(($a) => {
      if (!$a.hasClass('active')) {
        cy.wrap($a).click()
      }
    })
    cy.get('.modal-footer').should('be.visible').contains('Next').click()
    cy.get('.modal-body #new-location').should('be.visible').click()
    cy.get('.modal-footer a.btn-primary').should('be.visible').click()
  })
})
