import { CustomerRepository } from './CustomerRepository.js';

export class CustomerService {
  constructor(repository = new CustomerRepository()) {
    this.repository = repository;
  }

  getCustomerById(customerId) {
    return this.repository.getCustomerById(customerId);
  }

  findCustomerByExternalId(externalId) {
    return this.repository.findCustomerByExternalId(externalId);
  }

  saveCustomer(customerDraft) {
    return this.repository.saveCustomer(customerDraft);
  }
}
