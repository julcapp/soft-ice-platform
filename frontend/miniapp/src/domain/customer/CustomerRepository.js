import { NotImplementedError } from '../../shared/errors/index.js';

export class CustomerRepository {
  async getCustomerById(customerId) {
    throw new NotImplementedError();
  }

  async findCustomerByExternalId(externalId) {
    throw new NotImplementedError();
  }

  async saveCustomer(customerDraft) {
    throw new NotImplementedError();
  }
}
