const JUPYTER = Cypress.env('JUPYTER')
const MOCK_CONNECT = Cypress.env('MOCK_CONNECT')
const API_KEY = Cypress.env('API_KEY')

describe('Add server', () => {
  it('Visits the front page', () => {
    cy.visit(JUPYTER)
  })

  it('Creates a new notebook', () => {
    cy.contains('New').click()
    cy.contains('Python 3').click()
    cy.get('#refresh_notebook_list', { timeout: 5000 }).click()
  })

  it('Navigates to the new notebook', () => {
    cy.get('.item_link', { timeout: 5000 })
      .should('have.attr', 'href').and('include', 'notebooks')
      .then((href) => {
        cy.visit(JUPYTER + href)
      })
  })

  it('Opens the RStudio Connect publish dialog', () => {
    cy.get('.rsc-dropdown [data-jupyter-action="rsconnect_jupyter:publish"]').click()
    cy.get('#publish-to-connect').click()
  })

  it('Registers the new server address', () => {
    const typeOptions = { parseSpecialCharSequences: false, delay: 10 }
    cy.get('div.modal-dialog').then(($body) => {
      if ($body.find('#rsc-select-server').length) {
        cy.get('#rsc-select-server button').click()
      }
      if ($body.find('#rsc-add-server').length) {
        cy.get('#rsc-add-server').click()
      }
    })
    cy.wait(500);
    cy.get('#rsc-servername', { timeout: 5000 }).type('mock-connect', typeOptions)
    cy.get('#rsc-server').type(MOCK_CONNECT, typeOptions)
    cy.get('#rsc-api-key').type(API_KEY, typeOptions)
    cy.get('.modal-footer').contains('Add Server').click()
    cy.get('#rsc-select-server a.list-group-item')
      .contains('mock-connect')
      .contains(MOCK_CONNECT)
  })
})
