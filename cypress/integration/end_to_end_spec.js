const JUPYTER = Cypress.env('JUPYTER')
const MOCK_CONNECT = Cypress.env('MOCK_CONNECT')
const API_KEY = Cypress.env('API_KEY')

describe('End to end', {
  baseUrl: JUPYTER
}, () => {
  beforeEach(() => {
    cy.visit('/notebooks/feelings-about-cats.ipynb')
  })

  it('Registers the new server address', () => {
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
	cy.get('.modal-dialog button.close').should('be.visible').click()
  })

  it('Publishes with source', () => {
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
