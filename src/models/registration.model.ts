import {Model, model, property} from '@loopback/repository';

@model({settings: {strict: false}})
export class Registration extends Model {

  @property({
    type: 'string',
  })
  firstName?: string;

  @property({
    type: 'string',
  })
  lastName?: string;

  @property({
    type: 'string',
    required: true,
  })
  email: string;

  @property({
    type: 'string',
    required: true,
  })
  password: string;

  // G-lens profile
  @property({
    type: 'date',
    required: true,
  })
  birth: string;

  @property({
    type: 'string',
    required: true,
  })
  sex: string;

  @property({
    type: 'any',
  })
  pregnancyStatus?: any;

  @property({
    type: 'any',
  })
  breastFeeding?: any;

  @property({
    type: 'array',
    itemType: 'string',
  })
  intolerances?: any[];

  @property({
    type: 'array',
    itemType: 'string',
    required: true,
  })
  allergies: any[];

  @property({
    type: 'array',
    itemType: 'string',
    required: true,
  })
  diagnoses: any[];

  @property({
    type: 'array',
    itemType: 'string',
    required: true,
  })
  medicines: any[];

  @property({
    type: 'any',
    required: true,
  })
  howToMedication: any;

  @property({
    type: 'any',
    required: true,
  })
  whyTakeMedication: any;


  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Registration>) {
    super(data);
  }
}

export interface RegistrationRelations {
  // describe navigational properties here
}

export type RegistrationWithRelations = Registration & RegistrationRelations;
